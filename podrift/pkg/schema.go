package pkg

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func GetOauthClient(db *pgx.Conn, clientID string) (*ClientInfo, error) {
	var client ClientInfo
	err := db.QueryRow(context.Background(), "SELECT * FROM oauth_clients WHERE client_id = $1", clientID).Scan(
		&client.ClientID,
		&client.ClientSecret,
		&client.RedirectURIs,
		&client.ClientName,
		&client.LogoURI,
		&client.ClientURI,
		&client.PolicyURI,
		&client.TOSURI,
		&client.JWKSURI,
		&client.Contacts,
		&client.GrantTypes,
		&client.ResponseTypes,
		&client.RegistrationDate,
	)
	if err != nil {
		return nil, err
	}
	return &client, nil
}
