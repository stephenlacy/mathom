import { db } from "@/db/drizzle"
import { instances } from "@/db/schema"
import { auth } from "@/lib/auth"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

const DOMAIN = "dex.systems"

const RequestInput = z.object({
	name: z.string(),
	args: z.array(z.string()),
	runtime: z.enum(["node", "python", "bash"]).optional(),
})

const ResponseOutput = z.object({
	id: z.string(),
	uri: z.string(),
})

export const POST = async (req: Request) => {
	const session = await auth.api.getSession({
		headers: await headers(),
	})
	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const body = await req.json()
	const { name, args } = RequestInput.parse(body)

	const server = await runServer(name, "npx", args, session.user.id, "mathon-node:22.12-alpine")

	return NextResponse.json({
		id: server.id,
		uri: `http://${server.slug}.${DOMAIN}:9090/sse`,
	})
}

const runServer = async (
	name: string,
	cmd: string,
	args: string[],
	userId: string,
	runtime: string,
) => {
	const slug = "blue"
	const existing = await db
		.select()
		.from(instances)
		.where(and(eq(instances.userId, userId), eq(instances.name, name), eq(instances.args, args)))
		.execute()

	if (existing.length > 0) {
		return existing[0]
	}

	const res = await db
		.insert(instances)
		.values({
			userId: userId,
			runtime,
			name,
			cmd,
			args,
			slug,
			status: "pending",
		})
		.returning()

	return res[0]
}
