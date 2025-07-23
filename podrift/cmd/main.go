package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"os"
	"runtime"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/checkpoint"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"go.jetify.com/typeid"

	"github.com/stephenlacy/podrift/auth"
	"github.com/stephenlacy/podrift/pkg"
)

const (
	// Server configuration
	ServerAddr    = ":9090"
	BootTime      = 60 * time.Second  // Container boot time
	MaxBootTime   = 180 * time.Second // Maximum boot time
	ContainerPort = "80"
	TickInterval  = 3 * time.Second

	// Request timeout
	ClientTimeout = 2 * time.Second

	// Container configuration
	LaunchCommand = "mcp-proxy"
)

// Default launch arguments for containers
var LaunchArgs = []string{"--port", ContainerPort, "--host", "0.0.0.0", "--"}

// Context keys for request processing
type contextKey string

const (
	KeyRequestID        contextKey = "req_id"
	KeyRequestContainer contextKey = "req_item"
)

// Mathom represents the main application server
type Mathom struct {
	mutex            sync.RWMutex
	containers       []*pkg.Container
	oauthClients     *pkg.AuthCache
	server           http.Server
	client           *http.Client
	proxy            httputil.ReverseProxy
	containerRuntime *client.Client
	db               *pgxpool.Pool
}

func main() {
	ctx := context.Background()

	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// Initialize database connection
	db, err := initializeDatabase(ctx)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	dockerClient, err := initializeDockerClient()
	if err != nil {
		log.Fatal("Failed to initialize Docker client:", err)
	}

	oauthCache := &pkg.AuthCache{}

	app := &Mathom{
		containers:       []*pkg.Container{},
		containerRuntime: dockerClient,
		client: &http.Client{
			Timeout: ClientTimeout,
		},
		oauthClients: oauthCache,
		db:           db,
	}

	app.proxy = app.createReverseProxy()
	mux := http.NewServeMux()
	mux.HandleFunc(auth.MetadataEndpoint, app.wellKnownHandler)
	// mux.HandleFunc("/", app.subdomainHandler)
	mux.HandleFunc("/run", app.runHandler)
	mux.HandleFunc("/mcp/{id}", app.directHandler)

	startContainerManager(app)

	log.Printf("Server starting on %s", ServerAddr)
	log.Fatal(http.ListenAndServe(ServerAddr, mux))
}

func initializeDatabase(ctx context.Context) (*pgxpool.Pool, error) {
	conn, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	if _, err := conn.Query(ctx, "SELECT 1"); err != nil {
		conn.Close()
		return nil, fmt.Errorf("verifying database connection: %w", err)
	}

	return conn, nil
}

// initializeDockerClient creates Docker client
func initializeDockerClient() (*client.Client, error) {
	dockerClient, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("creating Docker client: %w", err)
	}
	return dockerClient, nil
}

// startContainerManager starts background container management
func startContainerManager(app *Mathom) {
	ticker := time.NewTicker(TickInterval)

	go func() {
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				app.manageContainers()
			}
		}
	}()
}

// container cleanup
func (m *Mathom) manageContainers() {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	now := time.Now().UnixMilli()
	maxIdleTime := int64(MaxBootTime.Milliseconds())

	// Clean up idle containers
	for i := len(m.containers) - 1; i >= 0; i-- {
		container := m.containers[i]

		if container.ConnectionCount == 0 &&
			container.LastReqAt > 0 &&
			now-container.LastReqAt > maxIdleTime {

			if err := m.stopContainer(container); err != nil {
				fmt.Printf("Error stopping container %s: %v\n", container.TypeID, err)
			}

			m.containers = slices.Delete(m.containers, i, i+1)
		}
	}
}

// wellKnownHandler handles OAuth discovery endpoints
func (m *Mathom) wellKnownHandler(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Build the base URL from the request
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	host := r.Host
	basePath := scheme + "://" + host

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(pkg.OauthMetadata{
		Issuer:                            basePath,
		AuthorizationEndpoint:             auth.WebURL + auth.AuthorizeEndpoint,
		TokenEndpoint:                     auth.WebURL + auth.TokenEndpoint,
		RegistrationEndpoint:              auth.WebURL + auth.ClientRegistrationEndpoint,
		ScopesSupported:                   []string{"read", "write"},
		ResponseTypesSupported:            auth.ResponseTypes,
		GrantTypesSupported:               auth.GrantTypes,
		TokenEndpointAuthMethodsSupported: auth.AuthMethodsSupported,
		RevocationEndpoint:                basePath + auth.RevocationEndpoint,
		CodeChallengeMethodsSupported:     auth.CodeChallengeMethodsSupported,
	})
}

// handle a request directly from mcx through the dashboard
func (m *Mathom) directHandler(w http.ResponseWriter, r *http.Request) {
	pathID := r.PathValue("id")

	// TODO: full checks
	if pathID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	// Get the container first to check if auth is needed
	m.mutex.RLock()
	exists := slices.IndexFunc(m.containers, func(item *pkg.Container) bool { return item.ID == pathID })
	m.mutex.RUnlock()

	id, err := typeid.FromString(pathID)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	var item *pkg.Container

	if exists == -1 {
		// Temporarily create container item to check OAuth vs API key auth
		tempItem := &pkg.Container{}
		err := m.db.QueryRow(r.Context(), "SELECT id, user_id, api_key, runtime, name, cmd, args FROM instances WHERE id = $1", id.UUID()).Scan(&tempItem.ID, &tempItem.UserID, &tempItem.ApiKey, &tempItem.Image, &tempItem.Name, &tempItem.Cmd, &tempItem.Args)
		if err != nil {
			fmt.Println("QueryRow 235", err)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		// Set required fields for HandleAuth
		tempItem.Domain = "-"
		tempItem.HostPort = 9090 // Default port from ADDR
		item = tempItem
	} else {
		m.mutex.RLock()
		item = m.containers[exists]
		m.mutex.RUnlock()
	}

	// First check for OAuth requests using HandleAuth
	handled, err := auth.HandleAuth(m.db, m.oauthClients, item, w, r)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	// If auth handled the request (OAuth endpoints), return early
	if handled {
		return
	}

	// Ensure item is in container list for proxying
	if exists == -1 {
		typeID, err := typeid.FromUUIDWithPrefix("instance", item.ID)
		if err != nil {
			fmt.Println("error generating typeID: ", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		item.TypeID = typeID.String()
		item.Domain = "-"
		m.mutex.Lock()
		m.containers = append(m.containers, item)
		m.mutex.Unlock()
	}

	r = m.proxyContainer(item, w, r)
	if r == nil {
		return
	}
	r.URL.Path = "/"
	m.proxy.ServeHTTP(w, r)
}

func (m *Mathom) runHandler(w http.ResponseWriter, r *http.Request) {
	res := &pkg.RunRequest{}
	err := json.NewDecoder(r.Body).Decode(res)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	// API key authentication check
	userID, err := auth.HandleApiAuth(m.db, r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	// TODO: full checks
	if res.ID == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	m.mutex.RLock()
	exists := slices.IndexFunc(m.containers, func(item *pkg.Container) bool { return item.ID == res.ID })
	m.mutex.RUnlock()

	id, err := typeid.FromString(res.ID)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	item := &pkg.Container{}
	if exists == -1 {
		err := m.db.QueryRow(r.Context(), "SELECT id, user_id, api_key, runtime, name, cmd, args FROM instances WHERE id = $1 AND user_id = $2", id.UUID(), userID).Scan(&item.ID, &item.UserID, &item.ApiKey, &item.Image, &item.Name, &item.Cmd, &item.Args)
		if err != nil {
			fmt.Println(err)
			w.WriteHeader(http.StatusNotFound)
			return
		}

		typeID, err := typeid.FromUUIDWithPrefix("instance", item.ID)
		if err != nil {
			fmt.Println("error generating typeID: ", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		item.TypeID = typeID.String()

		item.Domain = "-"
		m.mutex.Lock()
		m.containers = append(m.containers, item)
		m.mutex.Unlock()
	} else {
		m.mutex.RLock()
		item = m.containers[exists]
		m.mutex.RUnlock()
	}

	url := "http://" + r.Host + "/mcp/" + item.TypeID
	json.NewEncoder(w).Encode(map[string]string{"url": url})
}

func (m *Mathom) subdomainHandler(w http.ResponseWriter, r *http.Request) {
	host := r.Host
	domain := host[:strings.LastIndex(host, ":")]
	m.mutex.RLock()
	exists := slices.IndexFunc(m.containers, func(item *pkg.Container) bool { return item.Domain == domain })
	m.mutex.RUnlock()

	item := &pkg.Container{}
	if exists == -1 {
		slug := strings.Split(domain, ".")[0]

		err := m.db.QueryRow(r.Context(), "SELECT id, user_id, api_key, runtime, name, cmd, args FROM instances WHERE slug = $1", slug).Scan(&item.ID, &item.UserID, &item.ApiKey, &item.Image, &item.Name, &item.Cmd, &item.Args)
		if err != nil {
			fmt.Println("QueryRow 350", err)
			w.WriteHeader(http.StatusNotFound)
			return
		}

		typeID, err := typeid.FromUUIDWithPrefix("instance", item.ID)
		if err != nil {
			fmt.Println("error generating typeID: ", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		item.TypeID = typeID.String()

		item.Domain = domain
		m.mutex.Lock()
		m.containers = append(m.containers, item)
		m.mutex.Unlock()
	} else {
		m.mutex.RLock()
		item = m.containers[exists]
		m.mutex.RUnlock()
	}
	r = m.proxyContainer(item, w, r)
	if r == nil {
		return
	}
	m.proxy.ServeHTTP(w, r)

	// m.mutex.Lock()
	// defer m.mutex.Unlock()
}

func (m *Mathom) proxyContainer(item *pkg.Container, w http.ResponseWriter, r *http.Request) *http.Request {
	if item.StartAttempts > 10 {
		fmt.Println("container start attempts exceeded")
		// TODO: notify dashboard
		w.WriteHeader(http.StatusServiceUnavailable)
		return nil
	}

	item.ConnectionCount++

	defer func() {
		item.ConnectionCount--
	}()

	handled, err := auth.HandleAuth(m.db, m.oauthClients, item, w, r)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if strings.Contains(err.Error(), "query") {
			fmt.Println("query error: ", err)
			w.WriteHeader(http.StatusInternalServerError)
			return nil
		}
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
	}
	// auth handled the request
	if handled {
		return nil
	}

	now := time.Now().UnixMilli()
	// item.Mutex.RLock()
	if item.StartedAt+int64(BootTime.Milliseconds()) < now {
		// defer item.Mutex.RUnlock()

		if item.Host == "" {
			err := m.startContainer(item)
			if err != nil {
				fmt.Println("error starting container: ", err)
				w.WriteHeader(http.StatusServiceUnavailable)
				return nil
			}
		} else {
			// check if container is online
			resp, err := m.client.Get("http://" + item.Host)
			if err != nil || item.StoppedAt+int64(BootTime.Milliseconds()) < now {
				println("container is not started, starting it now")
				// start container
				err := m.startContainer(item)
				if err != nil {
					fmt.Println("error starting container 2: ", err)
					m.deleteContainer(item)
					if resp != nil {
						defer resp.Body.Close()
					}
					w.WriteHeader(http.StatusServiceUnavailable)
					return nil
				}
			}
			if resp != nil {
				defer resp.Body.Close()
			}
		}
	} else {
		// item.Mutex.RUnlock()
	}

	item.LastReqAt = now

	ctx := context.WithValue(r.Context(), KeyRequestContainer, item)
	r = r.WithContext(ctx)
	return r

	// forward
	// r.Header.Set("X-Forwarded-Host", r.Host)
	// r.URL.Scheme = "http"
	// r.URL.Host = item.Host
}

// createReverseProxy creates and configures the reverse proxy
func (m *Mathom) createReverseProxy() httputil.ReverseProxy {
	return httputil.ReverseProxy{
		Director: func(r *http.Request) {
			ctx := r.Context()
			item := ctx.Value(KeyRequestContainer).(*pkg.Container)

			r.Header.Set("X-Forwarded-Host", r.Host)
			r.URL.Scheme = "http"
			r.URL.Host = item.Host
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			if err != context.Canceled {
				fmt.Println("Proxy error:", err.Error())
			}
		},
	}
}

func (m *Mathom) startContainer(item *pkg.Container) error {
	// start container
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if item.ContainerID == "" {
		image := item.Image
		if item.Checkpoint != "" {
			image = item.Checkpoint
			item.Checkpoint = ""
		}
		args := append([]string{item.Cmd}, item.Args...)
		args = append(args, item.Name)
		con, err := m.containerRuntime.ContainerCreate(ctx, &container.Config{
			Image:      image,
			Entrypoint: []string{LaunchCommand},
			Cmd:        append(LaunchArgs, args...),
			Env:        []string{"MATHOM_ACCESS_TOKEN=" + item.ApiKey, "LOG_URL=" + os.Getenv("LOG_URL") + "/" + item.TypeID + "/logs"},
			ExposedPorts: nat.PortSet{
				nat.Port("80/tcp"): struct{}{},
			},
		}, &container.HostConfig{
			PortBindings: nat.PortMap{
				"80/tcp": []nat.PortBinding{
					{
						HostIP:   "0.0.0.0",
						HostPort: "",
					},
				},
			},
		}, nil, nil, item.TypeID)

		item.ContainerID = con.ID

		if err != nil {
			if !strings.Contains(err.Error(), "Conflict") {
				return err
			}

			// check if the container is running
			inspect, err := m.containerRuntime.ContainerInspect(ctx, item.TypeID)
			if err != nil {
				return err
			}
			item.ContainerID = inspect.ID
		}
	}
	item.StartAttempts++

	err := m.containerRuntime.ContainerStart(ctx, item.ContainerID, container.StartOptions{
		// CheckpointID: item.Checkpoint, // TODO: THIS
	})
	if err != nil {
		return err
	}

	// wait for container to be up

	count := 0
	for {
		inspect, err := m.containerRuntime.ContainerInspect(ctx, item.ContainerID)
		if err != nil {
			return err
		}

		if inspect.State.Running {
			// check if container is receiving traffic
			item.Host = fmt.Sprintf("%s:%s", inspect.NetworkSettings.Ports["80/tcp"][0].HostIP, inspect.NetworkSettings.Ports["80/tcp"][0].HostPort)
			resp, err := m.client.Get("http://" + item.Host)
			if err != nil {
				time.Sleep(time.Duration(rand.Intn(250)) * time.Millisecond)
				if count > 50 {
					item.StoppedAt = time.Now().UnixMilli()
					item.ContainerID = ""
					return errors.New("container is not running")
				}
				count++
				continue
			}
			defer resp.Body.Close()
			break // container is running
		}
	}

	item.StartedAt = time.Now().UnixMilli()
	item.StartAttempts = 0
	return nil
}

// remove item from containers
func (m *Mathom) deleteContainer(item *pkg.Container) {
	m.mutex.Lock()
	for i, c := range m.containers {
		if c.TypeID == item.TypeID {
			m.containers = slices.Delete(m.containers, i, i+1)
			break
		}
	}
	m.mutex.Unlock()
}

// snapshot container
func (m *Mathom) snapshotContainer(item *pkg.Container) error {
	if item.ContainerID == "" || item.Checkpoint != "" {
		return nil
	}
	fmt.Println("snapshotting container: ", item.ContainerID)
	item.Checkpoint = item.ContainerID
	if runtime.GOOS != "linux" {
		return nil
	}

	err := m.containerRuntime.CheckpointCreate(context.Background(), item.ContainerID, checkpoint.CreateOptions{
		CheckpointID: item.Checkpoint,
	})
	return err
}

func (m *Mathom) stopContainer(item *pkg.Container) error {
	// stop container
	if item.ContainerID == "" {
		return nil
	}

	err := m.containerRuntime.ContainerStop(context.Background(), item.ContainerID, container.StopOptions{})
	if err != nil {
		return err
	}
	item.StoppedAt = time.Now().UnixMilli()

	// item.ContainerID = ""
	return nil
}
