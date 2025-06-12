import { db } from "@/db/drizzle"
import { instances } from "@/db/schema"
import { auth } from "@/lib/auth"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

const DOMAIN = "dex.systems"
// const DOCKER_IMAGE = "mathon-node:22.12-alpine-rmcp-proxy" // "mathon-node:22.12-alpine",
const DOCKER_IMAGE = "mathon-node:22.12-alpine" // "mathon-node:22.12-alpine",

const domainMap = {
	"@modelcontextprotocol/server-everything": "blue",
	"@modelcontextprotocol/server-github": "green",
}

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
	console.log(body)
	const { name, args } = RequestInput.parse(body)

	const server = await createOrUpdateServer(name, "npx", args, session.user.id, DOCKER_IMAGE)

	return NextResponse.json({
		id: server.id,
		uri: `http://${server.slug}.${DOMAIN}:9090/sse`,
	})
}

const createOrUpdateServer = async (
	name: string,
	cmd: string,
	args: string[],
	userId: string,
	runtime: string,
) => {
	const slug = domainMap[name]

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
