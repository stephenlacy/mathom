package pkg

import (
	"slices"
	"sync"
	"time"
)

type RunRequest struct {
	ID       string   `json:"id"`
	UserID   string   `json:"userId"`
	Runtime  string   `json:"runtime"`
	Name     string   `json:"name"`
	Cmd      string   `json:"cmd"`
	Args     []string `json:"args"`
	Status   string   `json:"status"`
	ExitCode int      `json:"exitCode"`
	Slug     string   `json:"slug"`
	ApiKey   string   `json:"apiKey"`
}

type OauthMetadata struct {
	Issuer                            string   `json:"issuer"`
	AuthorizationEndpoint             string   `json:"authorization_endpoint"`
	TokenEndpoint                     string   `json:"token_endpoint"`
	RegistrationEndpoint              string   `json:"registration_endpoint"`
	ScopesSupported                   []string `json:"scopes_supported"`
	ResponseTypesSupported            []string `json:"response_types_supported"`
	GrantTypesSupported               []string `json:"grant_types_supported"`
	TokenEndpointAuthMethodsSupported []string `json:"token_endpoint_auth_methods_supported"`
	RevocationEndpoint                string   `json:"revocation_endpoint"`
	CodeChallengeMethodsSupported     []string `json:"code_challenge_methods_supported"`
}

// ClientMetadata is the metadata from a client
type ClientMetadata struct {
	RedirectURIs            []string  `json:"redirect_uris"`
	TokenEndpointAuthMethod string    `json:"token_endpoint_auth_method"`
	GrantTypes              []string  `json:"grant_types"`
	ResponseTypes           []string  `json:"response_types"`
	ClientName              string    `json:"client_name"`
	ClientURI               string    `json:"client_uri"`
	RegistrationDate        time.Time `json:"registration_date"`
	Scope                   string    `json:"scope"`
}

// ClientInfo represents information about an OAuth client
type ClientInfo struct {
	// ClientID is the unique identifier for the client
	ClientID string `json:"client_id"`
	// ClientSecret is the secret used to authenticate the client (stored as a hash)
	// Only present for confidential clients; empty for public clients.
	ClientSecret string `json:"client_secret,omitempty"`
	// RedirectURIs is a list of allowed redirect URIs for the client
	RedirectURIs []string `json:"redirect_uris"`
	// ClientName is the human-readable name of the client application
	ClientName string `json:"client_name,omitempty"`
	// LogoURI is the URL to the client's logo
	LogoURI string `json:"logo_uri,omitempty"`
	// ClientURI is the URL to the client's homepage
	ClientURI string `json:"client_uri,omitempty"`
	// PolicyURI is the URL to the client's privacy policy
	PolicyURI string `json:"policy_uri,omitempty"`
	// TOSURI is the URL to the client's terms of service
	TOSURI string `json:"tos_uri,omitempty"`
	// JWKSURI is the URL to the client's JSON Web Key Set for validating signatures
	JWKSURI string `json:"jwks_uri,omitempty"`
	// Contacts is a list of email addresses for contacting the client developers
	Contacts []string `json:"contacts,omitempty"`
	// GrantTypes is a list of grant types the client supports
	GrantTypes []string `json:"grant_types,omitempty"`
	// ResponseTypes is a list of response types the client supports
	ResponseTypes []string `json:"response_types,omitempty"`
	// RegistrationDate is the Unix timestamp when the client was registered
	RegistrationDate time.Time `json:"registration_date,omitempty"`
	// TokenEndpointAuthMethod is the authentication method used by the client at the token endpoint.
	// Values include:
	// - 'client_secret_basic': Uses HTTP Basic Auth with client ID and secret (default for confidential clients)
	// - 'client_secret_post': Uses POST parameters for client authentication
	// - 'none': Used for public clients that can't securely store secrets (SPAs, mobile apps, etc.)
	//
	// Public clients use 'none', while confidential clients use either 'client_secret_basic' or 'client_secret_post'.
	TokenEndpointAuthMethod string `json:"token_endpoint_auth_method"`
}

type AuthCacheItem struct {
	HeaderKey string
	ExpiresAt time.Time
}

type AuthCache struct {
	sync.RWMutex
	Items []*AuthCacheItem
}

func (c *AuthCache) Insert(headerKey string, expiresAt time.Time) {
	c.Lock()
	defer c.Unlock()
	c.Items = append(c.Items, &AuthCacheItem{
		HeaderKey: headerKey,
		ExpiresAt: expiresAt,
	})
}

// GetByHeader gets the entry from the key <userTypeID>:<grantTypeID>:<hash>
func (c *AuthCache) GetByHeader(headerKey string) *AuthCacheItem {
	now := time.Now().UnixMilli()
	c.RLock()
	defer c.RUnlock()
	for k, item := range c.Items {
		if item.HeaderKey == headerKey {
			if item.ExpiresAt.UTC().UnixMilli() < now {
				// remove expired item
				c.Items = slices.Delete(c.Items, k, k+1)
			}
			return item
		}
	}
	return nil
}
