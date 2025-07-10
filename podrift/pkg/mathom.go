package pkg

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"

	gonanoid "github.com/matoous/go-nanoid/v2"
)

type Container struct {
	Mutex           sync.RWMutex
	StartedAt       int64
	LastReqAt       int64
	StoppedAt       int64
	ID              string
	TypeID          string
	ContainerID     string
	UserID          string
	ApiKey          string
	Domain          string // TODO use domain prefix only
	Host            string
	Image           string
	Name            string
	Cmd             string
	Args            []string
	Checkpoint      string
	Auth            bool // enable auth
	Visibility      bool // public/private
	HostPort        int  // external port (9090 on dev)
	ConnectionCount int
	StartAttempts   int
}

// base58 characters
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

func GenerateID(len int) (string, error) {
	// generate a random ID with our alphabet
	return gonanoid.Generate(alphabet, len)
}

// GenerateTokenID generates a token ID
func GenerateTokenID(token string) string {
	hasher := sha256.New()

	hasher.Write([]byte(token))

	hashBytes := hasher.Sum(nil)

	hashHex := hex.EncodeToString(hashBytes)

	return hashHex
}
