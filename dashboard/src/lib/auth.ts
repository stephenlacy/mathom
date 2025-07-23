import { db } from "@/db/drizzle"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { apiKey, bearer, jwt, magicLink } from "better-auth/plugins"
import { localAnonymous } from "./plugins/local-anonymous"
import { config } from "./config"
import * as schema from "@/db/schema"
import { users } from "@/db/schema/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { typeid } from "typeid-js"

const plugins = [
	apiKey({
		permissions: {
			defaultPermissions: {
				logs: ["read"],
			},
		},
	}),
	bearer(),
	magicLink({
		sendMagicLink: async ({ email, token, url }) => {
			console.log({ email, token, url })
		},
	}),
	...(config.isLocal ? [localAnonymous()] : []),
]

export const auth = betterAuth({
	socialProviders: {
		github: {
			clientId: process.env.GITHUB_CLIENT_ID!,
			clientSecret: process.env.GITHUB_CLIENT_SECRET!,
		},
	},
	advanced: {
		generateId: ({ model }) => {
			return typeid(model).toString()
		},
		cookiePrefix: "mathom",
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 30 * 60, // in seconds
		},
	},
	plugins,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: { ...schema, apikeys: schema.apiKeys },
		usePlural: true,
	}),
})


export async function getUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})
	if (!session?.user) {
		redirect("/sign-in")
	}
	return session.user
}
