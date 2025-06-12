import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core"
import { defaults, typeId } from "./typeid"

export const users = pgTable("users", {
	...defaults("user"),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull(),
	image: text("image"),
})

export const sessions = pgTable("sessions", {
	...defaults("session"),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: typeId("users", "user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
})

export const accounts = pgTable("accounts", {
	...defaults("account"),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: typeId("users", "user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
})

export const verifications = pgTable("verifications", {
	...defaults("verification"),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
})

export const apiKeys = pgTable("api_keys", {
	...defaults("api_key"),
	name: text("name"),
	start: text("start"),
	prefix: text("prefix"),
	key: text("key").notNull(),
	userId: typeId("users", "user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	refillInterval: integer("refill_interval"),
	refillAmount: integer("refill_amount"),
	lastRefillAt: timestamp("last_refill_at"),
	enabled: boolean("enabled"),
	rateLimitEnabled: boolean("rate_limit_enabled"),
	rateLimitTimeWindow: integer("rate_limit_time_window"),
	rateLimitMax: integer("rate_limit_max"),
	requestCount: integer("request_count"),
	remaining: integer("remaining"),
	lastRequest: timestamp("last_request"),
	expiresAt: timestamp("expires_at"),
	permissions: text("permissions"),
	metadata: text("metadata"),
})
