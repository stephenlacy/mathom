import { db } from "@/db/drizzle"
import { instances, instanceLogs } from "@/db/schema"
import { auth } from "@/lib/auth"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

const LogStreamInput = z.object({
	logs: z.array(
		z.object({
			level: z.enum(["info", "error", "debug", "warn"]).default("info"),
			message: z.string(),
			timestamp: z.string().optional(),
			logType: z.enum(["mcp_stdout", "mcp_stderr", "cmd_log", "mcp_stdin"]).optional(),
		}),
	),
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
	const { logs } = LogStreamInput.parse(body)

	// Process logs in batches to avoid database limits
	// Also check for process events to update instance status
	const batchSize = 100
	const results = []
	let latestStatus = null
	let latestExitCode = null

	for (let i = 0; i < logs.length; i += batchSize) {
		const batch = logs.slice(i, i + batchSize)

		const logEntries = batch.map((log) => ({
			instanceId,
			level: log.level,
			message: log.message,
			timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
			logType: log.logType || "cmd_log",
		}))

		// Check for process events in this batch
		for (const log of batch) {
			try {
				const processEvent = JSON.parse(log.message)
				if (processEvent?.event) {
					if (processEvent.event === "process_start") {
						latestStatus = "running"
					} else if (processEvent.event === "process_exit") {
						latestStatus = "exited"
						// Extract exit code from signal_number or exit_code field
						latestExitCode =
							processEvent.signal_number?.toString() || processEvent.exit_code?.toString() || null
					} else if (
						processEvent.event === "signal_received" &&
						processEvent.action === "shutting_down"
					) {
						latestStatus = "exited"
					}
				}
			} catch {
				// Not a JSON message, continue
			}
		}

		const batchResults = await db.insert(instanceLogs).values(logEntries).returning()
		results.push(...batchResults)
	}

	// Update instance status if we found any process events, or if instance is pending and receiving logs
	if (latestStatus) {
		const updateData: any = { status: latestStatus }
		if (latestExitCode !== null) {
			updateData.exitCode = latestExitCode
		}

		await db.update(instances).set(updateData).where(eq(instances.id, instanceId))
	} else if (instance.status === "pending" && logs.length > 0) {
		// If instance is pending and we're receiving logs, mark it as running
		await db.update(instances).set({ status: "running" }).where(eq(instances.id, instanceId))
	}

	return NextResponse.json({
		success: true,
		inserted: results.length,
		logs: results,
	})
}
