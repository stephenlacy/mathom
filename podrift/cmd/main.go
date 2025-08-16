package main

import (
	"archive/tar"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"os"
	"runtime"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/checkpoint"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
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

	// Request timeout for health checks
	ClientTimeout = 5 * time.Second

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

	_ = godotenv.Load()

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

	// always fetch fresh data from database to get latest env values
	item := &pkg.Container{}
	err = m.db.QueryRow(r.Context(), "SELECT id, user_id, api_key, runtime, name, cmd, args, env FROM instances WHERE id = $1", id.UUID()).Scan(&item.ID, &item.UserID, &item.ApiKey, &item.Image, &item.Name, &item.Cmd, &item.Args, &item.Env)
	if err != nil {
		fmt.Println("QueryRow 235", err)
		w.WriteHeader(http.StatusNotFound)
		return
	}
	item.Domain = "-"
	item.HostPort = 9090 // Default port from ADDR

	if exists != -1 {
		m.mutex.RLock()
		oldItem := m.containers[exists]
		item.ContainerID = oldItem.ContainerID
		item.Host = oldItem.Host
		item.StartedAt = oldItem.StartedAt
		item.StoppedAt = oldItem.StoppedAt
		item.StartAttempts = oldItem.StartAttempts
		item.ConnectionCount = oldItem.ConnectionCount
		item.LastReqAt = oldItem.LastReqAt
		item.Checkpoint = oldItem.Checkpoint
		item.TypeID = oldItem.TypeID
		m.mutex.RUnlock()
	}

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
	} else {
		// Update existing container
		m.mutex.Lock()
		m.containers[exists] = item
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

	err = m.db.QueryRow(r.Context(), "SELECT id, user_id, api_key, runtime, name, cmd, args, env FROM instances WHERE id = $1 AND user_id = $2", id.UUID(), userID).Scan(&item.ID, &item.UserID, &item.ApiKey, &item.Image, &item.Name, &item.Cmd, &item.Args, &item.Env)
	if err != nil {
		fmt.Println(err)
		w.WriteHeader(http.StatusNotFound)
		return
	}

	typeID, err := typeid.FromUUIDWithPrefix("instance", item.ID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	item.TypeID = typeID.String()
	item.Domain = "-"

	if exists == -1 {
		m.mutex.Lock()
		m.containers = append(m.containers, item)
		m.mutex.Unlock()
	} else {
		m.mutex.Lock()
		oldItem := m.containers[exists]
		item.ContainerID = oldItem.ContainerID
		item.Host = oldItem.Host
		item.HostPort = oldItem.HostPort
		item.StartedAt = oldItem.StartedAt
		item.StoppedAt = oldItem.StoppedAt
		item.StartAttempts = oldItem.StartAttempts
		item.ConnectionCount = oldItem.ConnectionCount
		item.LastReqAt = oldItem.LastReqAt
		item.Checkpoint = oldItem.Checkpoint
		// Replace with updated item
		m.containers[exists] = item
		m.mutex.Unlock()
	}

	url := "http://" + r.Host + "/mcp/" + item.TypeID
	json.NewEncoder(w).Encode(map[string]string{"url": url, "uri": url, "id": item.TypeID})
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

		err := m.db.QueryRow(r.Context(), "SELECT id, user_id, api_key, runtime, name, cmd, args, env FROM instances WHERE slug = $1", slug).Scan(&item.ID, &item.UserID, &item.ApiKey, &item.Image, &item.Name, &item.Cmd, &item.Args, &item.Env)
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

// computeContainerConfigHash generates a hash of the container configuration
// to determine if a container needs to be recreated
func computeContainerConfigHash(imageName string, cmd []string, entrypoint []string, env []string) string {
	sortedEnv := make([]string, len(env))
	copy(sortedEnv, env)
	sort.Strings(sortedEnv)

	config := struct {
		Image      string   `json:"image"`
		Cmd        []string `json:"cmd"`
		Entrypoint []string `json:"entrypoint"`
		Env        []string `json:"env"`
	}{
		Image:      imageName,
		Cmd:        cmd,
		Entrypoint: entrypoint,
		Env:        sortedEnv,
	}

	// make a hash to compare the values
	data, _ := json.Marshal(config)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// buildMcpWrapperImage wraps a Docker image with mcp-proxy
func (m *Mathom) buildMcpWrapperImage(ctx context.Context, baseImage string) (string, error) {
	sanitizedName := strings.ReplaceAll(strings.ReplaceAll(baseImage, "/", "-"), ":", "-")
	wrappedImageName := fmt.Sprintf("mathom-wrapped-%s", sanitizedName)

	if _, err := m.containerRuntime.ImageInspect(ctx, wrappedImageName); err == nil {
		log.Printf("Reusing existing wrapped image: %s", wrappedImageName)
		return wrappedImageName, nil
	}

	// get the command from the base image
	baseInspect, err := m.containerRuntime.ImageInspect(ctx, baseImage)
	if err != nil {
		return "", fmt.Errorf("inspecting base image: %w", err)
	}

	baseCmd := append(baseInspect.Config.Entrypoint, baseInspect.Config.Cmd...)
	cmdString := ""
	if len(baseCmd) > 0 {
		cmdParts := make([]string, len(baseCmd))
		for i, part := range baseCmd {
			escaped := strings.ReplaceAll(part, `'`, `'\''`)
			cmdParts[i] = fmt.Sprintf(`'%s'`, escaped)
		}
		cmdString = fmt.Sprintf(" %s", strings.Join(cmdParts, " "))
	}

	dockerfileContent := fmt.Sprintf(`ARG BASE_IMAGE=%s
FROM ${BASE_IMAGE} as base
FROM ghcr.io/stephenlacy/mathom/mathom-proxy:main as proxy
FROM base
COPY --from=proxy /root/.cargo/bin/mcp-proxy /usr/local/bin/mcp-proxy
RUN chmod +x /usr/local/bin/mcp-proxy && \
    echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'exec /usr/local/bin/mcp-proxy --log-url "$LOG_URL" --port 80 --host 0.0.0.0 --%s' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
`, baseImage, cmdString)

	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)

	// add Dockerfile to tar
	header := &tar.Header{
		Name: "Dockerfile",
		Size: int64(len(dockerfileContent)),
		Mode: 0644,
	}
	if err := tw.WriteHeader(header); err != nil {
		return "", fmt.Errorf("failed to write tar header: %w", err)
	}
	if _, err := tw.Write([]byte(dockerfileContent)); err != nil {
		return "", fmt.Errorf("failed to write Dockerfile to tar: %w", err)
	}
	if err := tw.Close(); err != nil {
		return "", fmt.Errorf("failed to close tar writer: %w", err)
	}

	buildOptions := types.ImageBuildOptions{
		Tags:       []string{wrappedImageName},
		Dockerfile: "Dockerfile",
		BuildArgs: map[string]*string{
			"BASE_IMAGE": &baseImage,
		},
	}

	buildResponse, err := m.containerRuntime.ImageBuild(ctx, &buf, buildOptions)
	if err != nil {
		return "", fmt.Errorf("building image: %w", err)
	}
	defer buildResponse.Body.Close()

	// process build output
	decoder := json.NewDecoder(buildResponse.Body)
	for {
		var msg map[string]any
		if err := decoder.Decode(&msg); err != nil {
			if err == io.EOF {
				break
			}
			return "", fmt.Errorf("reading build output: %w", err)
		}
		if stream, ok := msg["stream"].(string); ok && stream != "" {
			log.Printf("Docker build: %s", strings.TrimSpace(stream))
		}
		if errorMsg, ok := msg["error"].(string); ok && errorMsg != "" {
			return "", fmt.Errorf("build error: %s", errorMsg)
		}
	}

	log.Printf("Successfully built wrapped image: %s", wrappedImageName)
	return wrappedImageName, nil
}

func (m *Mathom) startContainer(item *pkg.Container) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if item.ContainerID == "" {
		imageName := item.Image
		if item.Checkpoint != "" {
			imageName = item.Checkpoint
			item.Checkpoint = ""
		}

		// try to inspect and pull the image if not found
		_, err := m.containerRuntime.ImageInspect(ctx, imageName)
		if err != nil {
			if client.IsErrNotFound(err) {
				log.Printf("Docker image '%s' not found, attempting to pull...", imageName)

				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				defer cancel()

				reader, err := m.containerRuntime.ImagePull(ctx, imageName, image.PullOptions{})
				if err != nil {
					return fmt.Errorf("pulling image '%s': %w", imageName, err)
				}
				defer reader.Close()

				// read the pull output to make sure it completes
				buf := make([]byte, 8192)
				for {
					_, err := reader.Read(buf)
					if err != nil {
						// expect io.EOF
						break
					}
				}

				log.Printf("Successfully pulled Docker image '%s'", imageName)
			} else {
				return fmt.Errorf("failed to inspect image: %w", err)
			}
		}

		// wrap custom docker images with mcp-proxy
		isWrappedImage := item.Image != "" && !strings.Contains(item.Image, "mathom")
		if isWrappedImage {
			log.Printf("Building wrapped MCP image for: %s", imageName)
			buildCtx, buildCancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer buildCancel()
			wrappedImage, err := m.buildMcpWrapperImage(buildCtx, imageName)
			if err != nil {
				return fmt.Errorf("failed to build wrapped MCP image: %w", err)
			}
			imageName = wrappedImage
		}

		logURL := os.Getenv("LOG_URL") + "/" + item.TypeID + "/logs"

		// set passed through environment variables
		envVars := []string{
			"MATHOM_ACCESS_TOKEN=" + item.ApiKey,
			"LOG_URL=" + logURL,
			"LOG_AUTH_HEADER=Bearer " + item.ApiKey,
		}
		for key, value := range item.Env {
			envVars = append(envVars, key+"="+value)
		}

		containerConfig := &container.Config{
			Image: imageName,
			Env:   envVars,
			ExposedPorts: nat.PortSet{
				nat.Port("80/tcp"): struct{}{},
			},
			Labels: map[string]string{},
		}

		// configure container command and entrypoint
		if isWrappedImage {
			containerConfig.Entrypoint = []string{"/entrypoint.sh"}
		} else {
			args := item.Args
			if item.Cmd != "" {
				args = append([]string{item.Cmd}, args...)
			}
			args = append(args, item.Name)
			launchArgs := append([]string{"--log-url", logURL}, LaunchArgs...)
			containerConfig.Entrypoint = []string{LaunchCommand}
			containerConfig.Cmd = append(launchArgs, args...)
		}

		configHash := computeContainerConfigHash(
			containerConfig.Image,
			containerConfig.Cmd,
			containerConfig.Entrypoint,
			containerConfig.Env,
		)
		containerConfig.Labels["mathom.config.hash"] = configHash

		// the prior ctx might have expired
		createCtx, createCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer createCancel()

		con, err := m.containerRuntime.ContainerCreate(createCtx, containerConfig, &container.HostConfig{
			PortBindings: nat.PortMap{
				"80/tcp": []nat.PortBinding{
					{
						HostIP:   "0.0.0.0",
						HostPort: "",
					},
				},
			},
		}, nil, nil, item.TypeID)

		if err != nil {
			if !strings.Contains(err.Error(), "Conflict") {
				return err
			}

			inspect, err := m.containerRuntime.ContainerInspect(createCtx, item.TypeID)
			if err != nil {
				return err
			}

			// checkc if the existing container has the same configuration
			existingConfigHash := ""
			if inspect.Config.Labels != nil {
				existingConfigHash = inspect.Config.Labels["mathom.config.hash"]
			}

			if existingConfigHash != "" && existingConfigHash == configHash {
				log.Printf("Reusing existing container %s with matching configuration", item.TypeID)
				item.ContainerID = inspect.ID
			} else {
				// Use a fresh context for stopping and removing the container
				removeCtx, removeCancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer removeCancel()

				// cleanups
				_ = m.containerRuntime.ContainerStop(removeCtx, item.TypeID, container.StopOptions{})
				err := m.containerRuntime.ContainerRemove(removeCtx, item.TypeID, container.RemoveOptions{
					Force: true,
				})
				if err != nil {
					log.Printf("Failed to remove existing container: %v", err)
					return err
				}

				createCtx, createCancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer createCancel()

				con, err = m.containerRuntime.ContainerCreate(createCtx, containerConfig, &container.HostConfig{
					PortBindings: nat.PortMap{
						"80/tcp": []nat.PortBinding{
							{
								HostIP:   "0.0.0.0",
								HostPort: "",
							},
						},
					},
				}, nil, nil, item.TypeID)
				if err != nil {
					return fmt.Errorf("creating container: %w", err)
				}
				item.ContainerID = con.ID
			}
		} else {
			// Container created successfully
			item.ContainerID = con.ID
		}
	}
	item.StartAttempts++

	startCtx, startCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer startCancel()

	err := m.containerRuntime.ContainerStart(startCtx, item.ContainerID, container.StartOptions{
		// CheckpointID: item.Checkpoint, // TODO: THIS
	})
	if err != nil {
		return err
	}

	// wait for container to be up
	waitCtx, waitCancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer waitCancel()

	count := 0
	for {
		inspect, err := m.containerRuntime.ContainerInspect(waitCtx, item.ContainerID)
		if err != nil {
			return err
		}

		if inspect.State.Running {
			// check if container is receiving traffic
			hostIP := inspect.NetworkSettings.Ports["80/tcp"][0].HostIP
			if hostIP == "0.0.0.0" || hostIP == "" {
				hostIP = "127.0.0.1"
			}
			item.Host = fmt.Sprintf("%s:%s", hostIP, inspect.NetworkSettings.Ports["80/tcp"][0].HostPort)
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
