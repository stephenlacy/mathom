import { db } from "@/db/drizzle"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { apiKey, bearer, magicLink } from "better-auth/plugins"
import * as schema from "@/db/schema"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export const auth = betterAuth({
	advanced: {
		generateId: false,
		cookiePrefix: "runreal",
		database: {
			generateId: false,
		},
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 30 * 60, // in seconds
		},
	},
	plugins: [
		apiKey(),
		bearer(),
		magicLink({
			sendMagicLink: async ({ email, token, url }) => {
				console.log({ email, token, url })
			},
		}),
	],
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
