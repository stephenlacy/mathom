import { db } from "@/db/drizzle"
import { instances, instanceLogs } from "@/db/schema"
import { auth } from "@/lib/auth"
import { and, eq, desc, or } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

const LogIngestionInput = z.object({
	level: z.enum(["info", "error", "debug", "warn"]).default("info"),
	message: z.string(),
	timestamp: z.string().optional(),
	logType: z.enum(["mcp_stdout", "mcp_stderr", "cmd_log", "mcp_stdin"]).optional(),
})

const LogsQueryInput = z.object({
	logType: z
		.enum(["mcp_stdout", "mcp_stderr", "cmd_log", "mcp_stdin", "mcp"])
		.optional()
		.default("cmd_log"),
	level: z.enum(["info", "error", "debug", "warn"]).optional(),
	limit: z.coerce.number().min(1).max(1000).optional().default(100),
	offset: z.coerce.number().min(0).optional().default(0),
})

export const POST = async (
	req: Request,
	{ params }: { params: Promise<{ instanceId: string }> },
) => {
	const session = await auth.api.getSession({
		headers: await headers(),
	})
	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { instanceId } = await params

	// Verify user owns this instance
	const instance = await db.query.instances.findFirst({
		where: and(eq(instances.id, instanceId), eq(instances.userId, session.user.id)),
	})

	if (!instance) {
		return NextResponse.json({ error: "Instance not found" }, { status: 404 })
	}

	const body = await req.json()
	const { level, message, timestamp, logType } = LogIngestionInput.parse(body)

	// Parse process events from the message to update instance status
	let processEvent = null
	try {
		processEvent = JSON.parse(message)
	} catch {
		// Not a JSON message, continue normally
	}

	// Insert the log entry
	const logEntry = await db
		.insert(instanceLogs)
		.values({
			instanceId,
			level,
			message,
			timestamp: timestamp ? new Date(timestamp) : new Date(),
			logType: logType || "cmd_log",
		})
		.returning()

	// Update instance status based on process events or log activity
	let newStatus = null
	
	if (processEvent?.event) {
		if (processEvent.event === "process_start") {
			newStatus = "running"
		} else if (processEvent.event === "process_exit") {
			newStatus = "exited"
		} else if (processEvent.event === "signal_received") {
			// Keep status as running unless it's a shutdown signal
			if (processEvent.action === "shutting_down") {
				newStatus = "exited"
			}
		}
	} else if (instance.status === "pending") {
		// If instance is pending and we're receiving logs, mark it as running
		newStatus = "running"
	}

	if (newStatus) {
		await db
			.update(instances)
			.set({ status: newStatus })
			.where(eq(instances.id, instanceId))
	}

	return NextResponse.json(logEntry[0])
}

export const GET = async (
	req: Request,
	{ params }: { params: Promise<{ instanceId: string }> },
) => {
	const session = await auth.api.getSession({
		headers: await headers(),
	})
	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { instanceId } = await params
	const { searchParams } = new URL(req.url)

	const queryParams = LogsQueryInput.parse({
		logType: searchParams.get("logType") || undefined,
		level: searchParams.get("level") || undefined,
		limit: searchParams.get("limit") || undefined,
		offset: searchParams.get("offset") || undefined,
	})

	// Verify user owns this instance
	const instance = await db.query.instances.findFirst({
		where: and(eq(instances.id, instanceId), eq(instances.userId, session.user.id)),
	})

	if (!instance) {
		return NextResponse.json({ error: "Instance not found" }, { status: 404 })
	}

	// Build the where clause
	let whereClause = and(eq(instanceLogs.instanceId, instanceId))

	// Handle special 'mcp' logType that includes both mcp_stdout and mcp_stderr
	if (queryParams.logType === "mcp") {
		whereClause = and(
			whereClause,
			or(
				eq(instanceLogs.logType, "mcp_stdout"),
				eq(instanceLogs.logType, "mcp_stderr"),
				eq(instanceLogs.logType, "mcp_stdin"),
			),
		)
	} else {
		whereClause = and(whereClause, eq(instanceLogs.logType, queryParams.logType))
	}

	if (queryParams.level) {
		whereClause = and(whereClause, eq(instanceLogs.level, queryParams.level))
	}

	const logs = await db
		.select()
		.from(instanceLogs)
		.where(whereClause)
		.orderBy(desc(instanceLogs.timestamp))
		.limit(queryParams.limit)
		.offset(queryParams.offset)

	return NextResponse.json(logs)
}
