import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { defaults, typeId } from "./typeid"
import { instances } from "./instances"

export const instanceLogs = pgTable("instance_logs", {
	...defaults("instance_logs"),
	instanceId: typeId("instances", "instance_id")
		.notNull()
		.references(() => instances.id),
	level: text("level").notNull(), // e.g., "info", "error", "debug", "warn"
	message: text("message").notNull(),
	timestamp: timestamp("timestamp").notNull(),
})

export const instanceLogsRelations = relations(instanceLogs, ({ one }) => ({
	instance: one(instances, {
		fields: [instanceLogs.instanceId],
		references: [instances.id],
	}),
}))

export const instancesRelations = relations(instances, ({ many }) => ({
	logs: many(instanceLogs),
}))

export type InstanceLog = typeof instanceLogs.$inferSelect