import { db } from "@/db/drizzle"
import { instances, instanceLogs } from "@/db/schema"
import { and, eq, asc, desc, or } from "drizzle-orm"

export const listInstances = async (userId: string) => {
	const res = await db.select().from(instances).where(eq(instances.userId, userId)).execute()

	return res
}

export const getInstance = async (userId: string, instanceId: string) => {
	const res = await db.query.instances.findFirst({
		where: and(eq(instances.userId, userId), eq(instances.id, instanceId)),
		// with: {
		// 	logs: {
		// 		where: eq(instanceLogs.logType, "cmd_log"),
		// 		orderBy: asc(instanceLogs.timestamp),
		// 	},
		// },
	})

	if (!res) {
		throw new Error("Instance not found")
	}

	return res
}

export const getInstanceLogs = async (
	userId: string,
	instanceId: string,
	options: {
		logType?: "mcp_stdout" | "mcp_stderr" | "cmd_log" | "mcp_stdin" | "mcp"
		level?: "info" | "error" | "debug" | "warn"
		limit?: number
		offset?: number
	} = {},
) => {
	const { logType = "cmd_log", level, limit = 100, offset = 0 } = options

	// Verify user owns this instance
	const instance = await db.query.instances.findFirst({
		where: and(eq(instances.id, instanceId), eq(instances.userId, userId)),
	})

	if (!instance) {
		throw new Error("Instance not found")
	}

	// Build the where clause
	let whereClause = and(eq(instanceLogs.instanceId, instanceId))

	// Handle special 'mcp' logType that includes both mcp_stdout and mcp_stderr
	if (logType === "mcp") {
		whereClause = and(
			whereClause,
			or(
				eq(instanceLogs.logType, "mcp_stdout"),
				// eq(instanceLogs.logType, "mcp_stderr"),
				eq(instanceLogs.logType, "mcp_stdin"),
			),
		)
	} else {
		whereClause = and(whereClause, eq(instanceLogs.logType, logType))
	}

	if (level) {
		whereClause = and(whereClause, eq(instanceLogs.level, level))
	}

	const logs = await db
		.select()
		.from(instanceLogs)
		.where(whereClause)
		.orderBy(asc(instanceLogs.timestamp))
		.limit(limit)
		.offset(offset)

	return logs
}
