import { apiKeyClient, magicLinkClient, anonymousClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

const plugins = [
	magicLinkClient(),
	apiKeyClient(),
	anonymousClient(), // Always include for local development
]

export const authClient = createAuthClient({
	/** the base url of the server (optional if you're using the same domain) */
	baseURL: "http://localhost:5050",
	plugins,
})

export const { useSession, signOut } = authClient
