import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
	connectToRemoteServer,
	log,
	mcpProxy,
	setupSignalHandlers,
	// @ts-ignore
} from "mcp-remote/dist/chunk-FBGYN3F2.js"
import type { ApiResponses } from "./api"
import type { Config } from "./config"

export async function server(cfg: Config, opts: ApiResponses["instances"]["run"]) {
	const localTransport = new StdioServerTransport()
	const headers = {
		"x-api-key": cfg.accessToken,
	}
	const waitForAuthCode = () => null
	const authInitializer = () => ({
		waitForAuthCode,
		skipBrowserAuth: true,
	})
	const authProvider = null

	try {
		// Connect to remote server with authentication
		const remoteTransport = await connectToRemoteServer(
			null,
			opts.uri,
			authProvider,
			headers,
			authInitializer,
			"http-first",
		)

		// Set up bidirectional proxy between local and remote transports
		mcpProxy({
			transportToClient: localTransport,
			transportToServer: remoteTransport,
		})

		// Start the local STDIO server
		await localTransport.start()
		log("Local STDIO server running")
		log("Proxy established successfully between local STDIO and remote SSE")
		log("Press Ctrl+C to exit")

		// Setup cleanup handler
		const cleanup = async () => {
			await remoteTransport.close()
			await localTransport.close()
			// server.close()
		}
		setupSignalHandlers(cleanup)
	} catch (error) {
		console.error("Error establishing proxy:", error)
		process.exit(1)
	}
}
