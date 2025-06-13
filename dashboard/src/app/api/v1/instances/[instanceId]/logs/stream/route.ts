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
	const batchSize = 100
	const results = []

	for (let i = 0; i < logs.length; i += batchSize) {
		const batch = logs.slice(i, i + batchSize)

		const logEntries = batch.map((log) => ({
			instanceId,
			level: log.level,
			message: log.message,
			timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
			logType: log.logType || "cmd_log",
		}))

		const batchResults = await db.insert(instanceLogs).values(logEntries).returning()

		results.push(...batchResults)
	}

	return NextResponse.json({
		success: true,
		inserted: results.length,
		logs: results,
	})
}
