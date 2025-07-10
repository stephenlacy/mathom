package pkg

import "errors"

const (
	ERROR_MISSING_AUTH_HEADER       = "missing_auth_header"
	ERROR_INVALID_TOKEN             = "invalid_token"
	ERROR_INVALID_CLIENT            = "invalid_client"
	ERROR_INVALID_REQUEST           = "invalid_request"
	ERROR_UNAUTHORIZED_CLIENT       = "unauthorized_client"
	ERROR_UNSUPPORTED_GRANT_TYPE    = "unsupported_grant_type"
	ERROR_UNSUPPORTED_RESPONSE_TYPE = "unsupported_response_type"
	ERROR_INVALID_SCOPE             = "invalid_scope"
	ERROR_INVALID_REDIRECT_URI      = "invalid_redirect_uri"
	ERROR_INVALID_CLIENT_METADATA   = "invalid_client_metadata"
	ERROR_INVALID_CLIENT_ID         = "invalid_client_id"
	ERROR_INVALID_API_KEY           = "invalid_api_key"
	ERROR_MISSING_API_KEY           = "missing_api_key"
)

const (
	ERROR_DESCRIPTION_INVALID_TOKEN   = "Missing or invalid access token"
	ERROR_DESCRIPTION_INVALID_CLIENT  = "Missing or invalid client credentials"
	ERROR_DESCRIPTION_INVALID_REQUEST = "Missing or invalid request parameters"
)

type AuthError struct {
	Err     error
	Details string
}

func (e *AuthError) Error() string {
	return e.Err.Error()
}

func NewError(name string) error {
	return &AuthError{
		Err: errors.New(name),
	}
}

var ErrInvalidToken = errors.New(ERROR_INVALID_TOKEN)
