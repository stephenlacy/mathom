# mcx
> CLI for running mcp servers with mathom.

## Installation

```bash
npm install -g mcx
```

### Build from source

```bash
git clone https://github.com/stephenlacy/mathom.git
cd mathom/mcx
npm install
npm run build
npm link
```

## Configuration

mcx requires connection to your mathom instance. Set the environment variable or use the default:

```bash
export MATHOM_URL=http://localhost:5050
```

## Authentication

Authenticate with your Mathom instance:

```bash
mcx auth login
```

## Usage

Launch an MCP server by name or package:

```bash
mcx my-mcp-server

mcx @modelcontextprotocol/server-filesystem

mcx my-server -- --custom-arg value


mcx --docker mcp/github-mcp-server -e GITHUB_PERSONAL_ACCESS_TOKEN='ghp_token'
```

You can also use the inspector:
```bash
npx @modelcontextprotocol/inspector mcx @modelcontextprotocol/server-everything
```

### Claude/Cursor

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "myServer": {
      "command": "mcx",
      "args": ["-y", "my-mcp-server"],
      "env": {
        "MATHOM_URL": "http://localhost:5050"
      }
    }
  }
}
```


## Troubleshooting

**Connection refused**
- Verify Mathom instance is running
- Check MATHOM_URL environment variable
- Ensure Docker is running

**Authentication failed**
- Run `mcx auth login` to refresh tokens
- Verify Mathom dashboard is responding

**Container startup timeout**
- Ensure Docker images are available (check if you built the local images)
- Check system resource availability
- Review logs with `docker logs`

## License

MIT License

## Contributing

Contributions are welcome!
