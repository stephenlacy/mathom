import { timestamp, text, pgTable, boolean } from "drizzle-orm/pg-core"

export const cliVerifications = pgTable("cli_verifications", {
	code: text("code").primaryKey(),
	accessToken: text("access_token"),
	createdAt: timestamp("created_at").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	completed: boolean("completed").default(false),
})
