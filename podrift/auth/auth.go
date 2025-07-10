package auth

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stephenlacy/podrift/pkg"
	"go.jetify.com/typeid"
)

const (
	MetadataEndpoint = "/.well-known/oauth-authorization-server"
	// ProtectedResourceEndpoint  = "/.well-known/oauth-protected-resource"
	AuthorizeEndpoint          = "/oauth/authorize"    // WEB_URL + AuthorizeEndpoint
	TokenEndpoint              = "/api/oauth/token"    // WEB_URL + TokenEndpoint
	ClientRegistrationEndpoint = "/api/oauth/register" // "/register"
	RevocationEndpoint         = "/oauth/revoke"
	ONE_MiB                    = 1048576
	WebURL                     = "http://localhost:5050"
)

var (
	ResponseTypes                 = []string{"code"}
	GrantTypes                    = []string{"authorization_code", "refresh_token"}
	ResponseModesSupported        = []string{"query"}
	ResponseTypesSupported        = []string{"code"}
	CodeChallengeMethodsSupported = []string{"plain", "S256"}
	AuthMethodsSupported          = []string{"none", "client_secret_basic", "client_secret_post"}
)

// extractApiKey extracts API key from X-Api-Key or Authorization Bearer headers
func extractApiKey(r *http.Request) (string, error) {
	apiKey := r.Header.Get("X-Api-Key")
	if apiKey != "" {
		return apiKey, nil
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", pkg.NewError(pkg.ERROR_MISSING_API_KEY)
	}

	// Validate Bearer token format strictly
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}
	if len(authHeader) <= 7 {
		return "", pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}
	apiKey = strings.TrimSpace(authHeader[7:])
	if apiKey == "" {
		return "", pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}

	return apiKey, nil
}

// extractBearerToken extracts token from Authorization Bearer header only
func extractBearerToken(authHeader string) (string, error) {
	// Validate Bearer token format strictly
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}
	if len(authHeader) <= 7 {
		return "", pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}
	token := strings.TrimSpace(authHeader[7:])
	if token == "" {
		return "", pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}
	return token, nil
}

// validateApiKey validates a hashed API key against the database
func validateApiKey(db *pgxpool.Pool, ctx context.Context, apiKey string) (uuid.UUID, error) {
	h := sha256.New()
	h.Write([]byte(apiKey))
	hash := h.Sum(nil)
	enc := base64.URLEncoding.EncodeToString(hash)
	hashedKey := strings.Trim(enc, "=")

	var userID uuid.UUID
	err := db.QueryRow(ctx, "SELECT user_id FROM api_keys WHERE key = $1", hashedKey).Scan(&userID)
	if err != nil {
		return uuid.Nil, pkg.NewError(pkg.ERROR_INVALID_API_KEY)
	}

	return userID, nil
}

// validateOAuthToken validates an OAuth access token (format: userID:grantID:tokenHash)
func validateOAuthToken(db *pgxpool.Pool, ctx context.Context, token string) (uuid.UUID, error) {
	parts := strings.Split(token, ":")
	if len(parts) != 3 {
		fmt.Println("validateOAuthToken: invalid token length: " + strconv.Itoa(len(parts)))
		return uuid.Nil, pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}

	userID, err := typeid.FromString(parts[0])
	if err != nil {
		return uuid.Nil, pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}

	grantID, err := typeid.FromString(parts[1])
	if err != nil {
		return uuid.Nil, pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}

	// Validate OAuth token in database
	var expiresAt time.Time
	err = db.QueryRow(ctx, "SELECT expires_at FROM oauth_tokens WHERE grant_id = $1 AND user_id = $2", grantID.UUID(), userID.UUID()).Scan(&expiresAt)
	if err != nil {
		fmt.Println("db.QueryRow 122", err)
		return uuid.Nil, pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}

	if expiresAt.UTC().UnixMilli() < time.Now().UTC().UnixMilli() {
		return uuid.Nil, pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}

	return uuid.FromString(userID.UUID())
}

// HandleAuth returns true if the request is handled by the auth server
func HandleAuth(db *pgxpool.Pool, oauthClients *pkg.AuthCache, item *pkg.Container, w http.ResponseWriter, r *http.Request) (bool, error) {
	path := r.URL.Path
	method := r.Method

	addCorsHeaders(w, r)
	if method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return true, nil
	}

	scheme := r.URL.Scheme
	if scheme == "" {
		scheme = "http://"
	}
	basePath := scheme + item.Domain + ":" + strconv.Itoa(item.HostPort)

	// well-known endpoint
	if path == MetadataEndpoint {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(pkg.OauthMetadata{
			Issuer:                            basePath,
			AuthorizationEndpoint:             WebURL + AuthorizeEndpoint,
			TokenEndpoint:                     WebURL + TokenEndpoint,
			RegistrationEndpoint:              WebURL + ClientRegistrationEndpoint,
			ScopesSupported:                   []string{"read", "write"},
			ResponseTypesSupported:            ResponseTypes,
			GrantTypesSupported:               GrantTypes,
			TokenEndpointAuthMethodsSupported: AuthMethodsSupported,
			RevocationEndpoint:                basePath + RevocationEndpoint,
			CodeChallengeMethodsSupported:     CodeChallengeMethodsSupported,
		})
		return true, nil
	}

	// check auth
	apiKeyHeader := r.Header.Get("X-Api-Key")

	if apiKeyHeader != "" {
		// Use common validation logic for simple API key
		_, err := validateApiKey(db, r.Context(), apiKeyHeader)
		if err != nil {
			fmt.Println("validateApiKey", err)
			return true, err
		}
		// can continue, no error
		return false, nil
	}

	authHeader := r.Header.Get("Authorization")

	if authHeader == "" {
		return true, pkg.NewError(pkg.ERROR_MISSING_AUTH_HEADER)
	}

	// Extract token using Bearer-specific logic
	headerKey, err := extractBearerToken(authHeader)
	if err != nil {
		return true, err
	}

	// This must be an OAuth token (Bearer format), validate it
	parts := strings.Split(headerKey, ":")
	if len(parts) != 3 {
		return true, pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}

	userID, err := typeid.FromString(parts[0])
	if err != nil {
		return true, pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}

	grantID, err := typeid.FromString(parts[1])
	if err != nil {
		return true, pkg.NewError(pkg.ERROR_INVALID_TOKEN)
	}

	// check auth cache
	existing := oauthClients.GetByHeader(headerKey)
	if existing != nil {
		// can continue, no error
		return false, nil
	}

	rows, err := db.Query(r.Context(), "SELECT expires_at FROM oauth_tokens WHERE grant_id = $1 AND user_id = $2", grantID.UUID(), userID.UUID())
	if err != nil {
		fmt.Println("db.Query 219", err)
		return true, err
	}

	now := time.Now().UTC().UnixMilli()
	defer rows.Close()
	for rows.Next() {
		var expiresAt time.Time
		if err := rows.Scan(&expiresAt); err != nil {
			return true, pkg.NewError(pkg.ERROR_INVALID_TOKEN)
		}
		if expiresAt.UTC().UnixMilli() < now {
			fmt.Println("---> TOKEN EXPIRED: expiresAt", expiresAt.UTC().UnixMilli(), "< now", now, "diff =", now-expiresAt.UTC().UnixMilli(), "ms")
			return true, pkg.NewError(pkg.ERROR_INVALID_TOKEN)
		}
		if expiresAt.UTC().UnixMilli() > now {
			oauthClients.Insert(headerKey, expiresAt)
			// can continue, no error
			return false, nil
		}
	}

	return true, errors.New(pkg.ERROR_UNAUTHORIZED_CLIENT)
}

// HandleApiAuth checks headers for api keys or access tokens
func HandleApiAuth(db *pgxpool.Pool, r *http.Request) (uuid.UUID, error) {
	apiKey, err := extractApiKey(r)
	if err != nil {
		return uuid.Nil, err
	}

	// Check if this is an OAuth access token (contains ":")
	if strings.Contains(apiKey, ":") {
		return validateOAuthToken(db, r.Context(), apiKey)
	}

	// Handle as simple API key
	return validateApiKey(db, r.Context(), apiKey)
}

// addCorsHeaders adds CORS headers to HTTP responses
func addCorsHeaders(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-protocol-version")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
}
