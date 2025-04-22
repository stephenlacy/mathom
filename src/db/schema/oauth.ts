import { jsonb, pgTable, text } from "drizzle-orm/pg-core"
import { defaults, typeId } from "./typeid"
import { users } from "./auth"

export const oauthTokens = pgTable("oauth_tokens", {
	...defaults("oauth_tokens"),
	userId: typeId("users", "user_id")
		.notNull()
		.references(() => users.id),
})

export const oauthClients = pgTable("oauth_clients", {
	...defaults("oauth_clients"),
	userId: typeId("users", "user_id")
		.notNull()
		.references(() => users.id),
	clientId: text("client_id").notNull(),
	clientSecret: text("client_secret").notNull(),
	grant: text("grant").notNull(),
})
