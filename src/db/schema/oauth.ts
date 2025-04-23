import { jsonb, pgTable, text, varchar, timestamp, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { defaults, nullableTypeId, typeId } from "./typeid"
import { users } from "./auth"

export const oauthClients = pgTable("oauth_clients", {
	...defaults("oauth_clients"),
	userId: nullableTypeId("users", "user_id").references(() => users.id),
	clientId: text("client_id").notNull().unique(),
	clientSecret: text("client_secret"),
	redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
	clientName: text("client_name"),
	logoUri: text("logo_uri"),
	clientUri: text("client_uri"),
	policyUri: text("policy_uri"),
	tosUri: text("tos_uri"),
	jwksUri: text("jwks_uri"),
	contacts: jsonb("contacts").$type<string[]>(),
	grantTypes: jsonb("grant_types")
		.$type<string[]>()
		.notNull()
		.default(sql`'["authorization_code", "refresh_token"]'`),
	responseTypes: jsonb("response_types").$type<string[]>().notNull().default(sql`'["code"]'`),
	registrationDate: timestamp("registration_date").notNull().default(sql`timezone('utc', now())`),
	tokenEndpointAuthMethod: text("token_endpoint_auth_method")
		.notNull()
		.default("client_secret_basic"),
})

export const oauthGrants = pgTable("oauth_grants", {
	...defaults("oauth_grants"),
	userId: typeId("users", "user_id")
		.notNull()
		.references(() => users.id),
	clientId: text("client_id")
		.notNull()
		.references(() => oauthClients.clientId),
	scope: jsonb("scope").$type<string[]>().notNull(),
	metadata: jsonb("metadata").notNull(),
	encryptedProps: text("encrypted_props").notNull(),
	refreshTokenId: text("refresh_token_id"),
	refreshTokenWrappedKey: text("refresh_token_wrapped_key"),
	previousRefreshTokenId: text("previous_refresh_token_id"),
	previousRefreshTokenWrappedKey: text("previous_refresh_token_wrapped_key"),
	authCodeId: text("auth_code_id"),
	authCodeWrappedKey: text("auth_code_wrapped_key"),
	codeChallenge: text("code_challenge"),
	codeChallengeMethod: text("code_challenge_method"),
	expiresAt: timestamp("expires_at"),
})

export const oauthTokens = pgTable("oauth_tokens", {
	...defaults("oauth_tokens"),
	grantId: typeId("oauth_grants", "grant_id")
		.notNull()
		.references(() => oauthGrants.id),
	userId: typeId("users", "user_id")
		.notNull()
		.references(() => users.id),
	tokenId: text("token_id").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	wrappedEncryptionKey: text("wrapped_encryption_key").notNull(),
	clientId: text("client_id").notNull(),
	scope: jsonb("scope").$type<string[]>().notNull(),
	encryptedProps: text("encrypted_props").notNull(),
})
