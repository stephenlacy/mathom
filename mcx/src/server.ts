import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { connectToRemoteServer, log, mcpProxy, setupSignalHandlers } from "./transport.js"
import type { ApiResponses } from "./api"
import type { Config } from "./config"

export async function server(cfg: Config, opts: ApiResponses["instances"]["run"]) {
	const localTransport = new StdioServerTransport()
	const headers: Record<string, string> = {}
	if (cfg.accessToken) {
		headers["X-Api-Key"] = cfg.accessToken
	}

	const waitForAuthCode = () => {
		return Promise.resolve("")
	}
	const authInitializer = () => {
		return Promise.resolve({
			waitForAuthCode,
			skipBrowserAuth: true,
		})
	}
	const authProvider = undefined

	try {
		// Connect to remote server with authentication (using null client like original)
		// Use http-only to force StreamableHTTP transport which properly handles HTTP+streamable
		const remoteTransport = await connectToRemoteServer(
			null,
			opts.uri,
			authProvider,
			headers,
			authInitializer,
			"http-only",
		)

		// Set up bidirectional proxy between local and remote transports
		mcpProxy({
			transportToClient: localTransport,
			transportToServer: remoteTransport,
		})

		// Start the local STDIO server AFTER remote connection is established
		await localTransport.start()
		log("Local STDIO server running")
		log("Proxy established successfully between local STDIO and remote transport")
		log("Press Ctrl+C to exit")

		// Setup cleanup handler
		const cleanup = async () => {
			await remoteTransport.close()
			await localTransport.close()
		}
		setupSignalHandlers(cleanup)
	} catch (error) {
		console.error("Error establishing proxy:", error)
		process.exit(1)
	}
}
