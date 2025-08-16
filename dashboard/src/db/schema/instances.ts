import { jsonb, pgTable, text } from "drizzle-orm/pg-core"
import { defaults, typeId } from "./typeid"
import { users } from "./auth"

export const instances = pgTable("instances", {
	...defaults("instances"),
	userId: typeId("users", "user_id")
		.notNull()
		.references(() => users.id),
	runtime: text("runtime").notNull(),
	name: text("name").notNull(),
	cmd: text("cmd").notNull(),
	args: jsonb("args").notNull(),
	env: jsonb("env"),
	status: text("status").notNull(),
	exitCode: text("exit_code"),
	slug: text("slug").notNull(),
	apiKey: text("api_key"),
})

export type Instance = typeof instances.$inferSelect
