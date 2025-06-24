// Initially taken from https://github.com/geelen/mcp-remote
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js"
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"

// Constants
const MCP_REMOTE_VERSION = require("../package.json").version
const REASON_AUTH_NEEDED = "authentication-needed"
const REASON_TRANSPORT_FALLBACK = "falling-back-to-alternate-transport"

// Transport strategy types
export type TransportStrategy = "sse-only" | "http-only" | "sse-first" | "http-first"

const pid = process.pid

import { appendFileSync } from "fs"
import { join } from "path"

const logFile = join(process.cwd(), `mcx-debug-${pid}.log`)

// Immediate log to verify module is loaded

export function log(str: string, ...rest: unknown[]) {
	const message = `[${new Date().toISOString()}] [${pid}] ${str} ${rest.map((r) => (typeof r === "object" ? JSON.stringify(r) : String(r))).join(" ")}\n`

	// Write to both stderr and file

	try {
		appendFileSync(logFile, message)
	} catch (e) {
		// Ignore file write errors
	}
}

export function mcpProxy({
	transportToClient,
	transportToServer,
}: { transportToClient: Transport; transportToServer: Transport }) {
	let transportToClientClosed = false
	let transportToServerClosed = false

	transportToClient.onmessage = (_message) => {
		const message = _message as any
		log("[Local→Remote]", message.method || message.id)

		if (message.method === "initialize") {
			const { clientInfo } = message.params
			if (clientInfo) clientInfo.name = `${clientInfo.name} (via mcx ${MCP_REMOTE_VERSION})`
			log("[INITIALIZE]", JSON.stringify(message, null, 2))
		}

		transportToServer.send(message).catch(onServerError)
	}

	transportToServer.onmessage = (_message) => {
		const message = _message as any
		log(
			"[Remote→Local]",
			message.method || message.id || (message.result !== undefined ? "result" : "unknown"),
		)

		// Log raw message for debugging
		log("[RAW_MESSAGE]", JSON.stringify(message, null, 2))

		// Log all message details for debugging
		if (message.method) {
			log("[MESSAGE_DETAILS]", JSON.stringify({ method: message.method, id: message.id }, null, 2))

			// Special handling for notifications
			if (message.method.startsWith("notifications/")) {
				log("[NOTIFICATION_RECEIVED]", JSON.stringify(message, null, 2))
			}
		} else if (message.result !== undefined) {
			log("[RESULT_DETAILS]", JSON.stringify({ id: message.id, hasResult: true }, null, 2))
		} else if (message.error) {
			log("[ERROR_DETAILS]", JSON.stringify({ id: message.id, error: message.error }, null, 2))
		}

		transportToClient.send(message).catch(onClientError)
	}

	transportToClient.onclose = () => {
		if (transportToServerClosed) {
			return
		}

		transportToClientClosed = true
		transportToServer.close().catch(onServerError)
	}

	transportToServer.onclose = () => {
		if (transportToClientClosed) {
			return
		}
		transportToServerClosed = true
		transportToClient.close().catch(onClientError)
	}

	transportToClient.onerror = onClientError
	transportToServer.onerror = onServerError

	function onClientError(error: Error) {
		log(
			"Error from local client:",
			error?.message || "Unknown error",
			error?.stack || "No stack trace",
		)
	}

	function onServerError(error: Error) {
		log(
			"Error from remote server:",
			error?.message || "Unknown error",
			error?.stack || "No stack trace",
		)
		if (error && typeof error === "object") {
			log("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)))
		}
	}
}

/**
 * Type for the auth initialization function
 */
export type AuthInitializer = () => Promise<{
	waitForAuthCode: () => Promise<string>
	skipBrowserAuth: boolean
}>

/**
 * Creates and connects to a remote server with OAuth authentication
 */
export async function connectToRemoteServer(
	client: Client | null,
	serverUrl: string,
	authProvider: OAuthClientProvider | undefined,
	headers: Record<string, string>,
	authInitializer: AuthInitializer,
	transportStrategy: TransportStrategy = "http-first",
	recursionReasons: Set<string> = new Set(),
): Promise<Transport> {
	log(`[${pid}] Connecting to remote server: ${serverUrl}`)
	const url = new URL(serverUrl)

	// Create transport with eventSourceInit to pass Authorization header if present
	const eventSourceInit = {
		fetch: (url: string | URL, init?: RequestInit) => {
			return Promise.resolve(authProvider?.tokens?.()).then((tokens) =>
				fetch(url, {
					...init,
					headers: {
						...(init?.headers as Record<string, string> | undefined),
						...headers,
						...(tokens?.access_token ? { Authorization: `Bearer ${tokens.access_token}` } : {}),
						Accept: "text/event-stream",
					} as Record<string, string>,
				}),
			)
		},
	}

	log(`Using transport strategy: ${transportStrategy}`)
	// Determine if we should attempt to fallback on error
	const shouldAttemptFallback =
		transportStrategy === "http-first" || transportStrategy === "sse-first"

	// Create transport instance based on the strategy
	const useSSE = transportStrategy === "sse-only" || transportStrategy === "sse-first"
	const transport = useSSE
		? new SSEClientTransport(url, {
				authProvider,
				requestInit: { headers },
				eventSourceInit,
			})
		: new StreamableHTTPClientTransport(url, {
				authProvider,
				requestInit: { headers },
			})

	try {
		log(`Attempting to connect using ${transport.constructor.name}`)

		if (client) {
			await client.connect(transport)
		} else {
			await transport.start()
			if (!useSSE) {
				// Create a test transport for HTTP-only connection test
				const testTransport = new StreamableHTTPClientTransport(url, {
					authProvider,
					requestInit: { headers },
				})
				const testClient = new Client(
					{ name: "mcx-fallback-test", version: "0.0.0" },
					{ capabilities: {} },
				)
				await testClient.connect(testTransport)
			} else {
				// For SSE, verify endpoint was discovered
				const sseTransport = transport as any
				if (sseTransport._endpoint) {
					log(`SSE endpoint discovered: ${sseTransport._endpoint.href}`)
				} else {
					log(`WARNING: SSE endpoint not discovered after connection`)
				}
			}
		}
		log(`Connected to remote server using ${transport.constructor.name}`)

		// Log which transport type we're actually using
		if (transport.constructor.name === "SSEClientTransport") {
			log(`SSE transport active - notifications should work`)

			// Check if SSE transport has discovered the message endpoint
			const sseTransport = transport as any
			if (sseTransport._endpoint) {
				log(`SSE message endpoint: ${sseTransport._endpoint.href}`)
			} else {
				log(`WARNING: SSE transport has no message endpoint - server must send 'endpoint' event`)
			}
		} else if (transport.constructor.name === "StreamableHTTPClientTransport") {
			log(`StreamableHTTP transport active - checking if SSE stream is open`)

			// Check if the transport has an active SSE stream
			const httpTransport = transport as any
			if (httpTransport._sseConnected || httpTransport._streamConnected) {
				log(`SSE stream is active - notifications should work`)
			} else {
				log(`WARNING: No SSE stream - server may not support GET /sse or returned 405`)
			}
		}

		return transport
	} catch (error: any) {
		// Check if it's a protocol error and we should attempt fallback
		if (
			error instanceof Error &&
			shouldAttemptFallback &&
			(error.message.includes("405") ||
				error.message.includes("Method Not Allowed") ||
				error.message.includes("404") ||
				error.message.includes("Not Found") ||
				error.message.includes("page not found"))
		) {
			log(`Received error: ${error.message}`)

			// If we've already tried falling back once, throw an error
			if (recursionReasons.has(REASON_TRANSPORT_FALLBACK)) {
				const errorMessage = `Already attempted transport fallback. Giving up.`
				log(errorMessage)
				throw new Error(errorMessage)
			}

			log(`Recursively reconnecting for reason: ${REASON_TRANSPORT_FALLBACK}`)

			// Add to recursion reasons set
			recursionReasons.add(REASON_TRANSPORT_FALLBACK)

			// Recursively call connectToRemoteServer with the updated recursion tracking
			return connectToRemoteServer(
				client,
				serverUrl,
				authProvider,
				headers,
				authInitializer,
				useSSE ? "http-only" : "sse-only",
				recursionReasons,
			)
		} else if (
			error instanceof UnauthorizedError ||
			(error instanceof Error && error.message.includes("Unauthorized"))
		) {
			log("Authentication required. Initializing auth...")

			// Initialize authentication on-demand
			const { waitForAuthCode, skipBrowserAuth } = await authInitializer()

			if (skipBrowserAuth) {
				log("Authentication required but skipping browser auth - using shared auth")
			} else {
				log("Authentication required. Waiting for authorization...")
			}

			// Wait for the authorization code from the callback
			const code = await waitForAuthCode()

			try {
				log("Completing authorization...")
				await transport.finishAuth(code)

				if (recursionReasons.has(REASON_AUTH_NEEDED)) {
					const errorMessage = `Already attempted reconnection for reason: ${REASON_AUTH_NEEDED}. Giving up.`
					log(errorMessage)
					throw new Error(errorMessage)
				}

				// Track this reason for recursion
				recursionReasons.add(REASON_AUTH_NEEDED)
				log(`Recursively reconnecting for reason: ${REASON_AUTH_NEEDED}`)

				// Recursively call connectToRemoteServer with the updated recursion tracking
				return connectToRemoteServer(
					client,
					serverUrl,
					authProvider,
					headers,
					authInitializer,
					transportStrategy,
					recursionReasons,
				)
			} catch (authError: any) {
				log("Authorization error:", authError)
				throw authError
			}
		} else {
			log("Connection error:", error)
			throw error
		}
	}
}

/**
 * Sets up signal handlers for graceful shutdown
 */
export function setupSignalHandlers(cleanup: () => Promise<void>) {
	process.on("SIGINT", async () => {
		log("\nShutting down...")
		await cleanup()
		process.exit(0)
	})

	// Keep the process alive
	process.stdin.resume()
	process.stdin.on("end", async () => {
		log("\nShutting down...")
		await cleanup()
		process.exit(0)
	})
}
