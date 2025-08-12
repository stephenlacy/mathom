# mathom
> Local-first MCP platform with OAuth2 for running and monitoring your servers.

![hero](./assets/hero.jpg)

### Install mcx CLI

```bash
npm i -g mcx
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
OR:
- Node.js and pnpm
- PostgreSQL

### Quick Start

```bash
git clone https://github.com/stephenlacy/mathom.git
cd mathom

cd podrift && ./build.sh && cd ..

docker compose up -d
```

This will start the dashboard on [localhost:5050](http://localhost:5050) with auth disabled in local mode.

![screnshot2](./assets/screenshot2.jpg)

### Authenticate

```bash
mcx auth login
```

This will open your browser to authenticate

### Launch Server

You can launch any npx/ux and most other MCP servers

```bash
mcx -y my-mcp-server
```

## Configure Claude Desktop

Update `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "myMCPServer": {
      "command": "mcx",
      "args": ["-y", "my-mcp-server"],
      "env": {
        "MATHOM_URL": "http://localhost:5050"
      }
    }
  }
}
```

## Usage

```bash
mcx @modelcontextprotocol/server-everything
```

Using the inspector:
```sh
npx @modelcontextprotocol/inspector@0.15.0 mcx @modelcontextprotocol/server-everything
```

## Development

### Running in Development Mode

```bash
cd dashboard
pnpm install
pnpm dev

cd podrift
go run cmd/main.go
```

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Dashboard
BETTER_AUTH_URL=http://localhost:5050
DATABASE_URL=postgresql://postgres:postgres@localhost:54320/main

# Podrift
LOG_URL=http://host.docker.internal:5050/api/v1/instances
MATHOM_RUNTIME=docker
```

## License

MIT
