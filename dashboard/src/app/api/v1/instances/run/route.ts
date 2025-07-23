import { db } from "@/db/drizzle"
import { instances } from "@/db/schema"
import { Instance } from "@/db/schema/instances"
import { auth } from "@/lib/auth"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

const MATHOM_RUNTIME = process.env.MATHOM_RUNTIME
const MATHOM_RUNTIME_URL = process.env.MATHOM_RUNTIME_URL!
const DOCKER_IMAGES = {
	generic: "",
	node: "mathom-node:22.12-alpine-mathom-proxy",
}

const RequestInput = z.object({
	name: z.string(),
	cmd: z.string().optional(),
	args: z.array(z.string()),
	runtime: z.enum(["node", "python", "bash"]).optional(),
})

const ResponseOutput = z.object({
	id: z.string(),
	uri: z.string(),
})

export const POST = async (req: Request) => {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		})
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const body = await req.json()
		const { name, image, cmd, args } = await getContainerDetails(RequestInput.parse(body))

		const server = await createOrUpdateServer(name, cmd, args, session.user.id, image)

		const run = await getRuntime(server).catch((e) => {
			console.error("getRuntime error:", e)
			return null
		})
		console.log({ run })

		if (!run) {
			return NextResponse.json(
				{
					error: "Container runtime offline",
				},
				{
					status: 500,
				},
			)
		}

		return NextResponse.json({
			id: server.id,
			uri: run.url,
		})
	} catch (e) {
		console.log(e)

		// Check if it's an API key error
		if (e instanceof Error && e.message.includes("Invalid API key")) {
			return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
		}

		// Generic error response
		return NextResponse.json({ error: "Internal server error" }, { status: 500 })
	}
}

const getRuntime = async (instance: Instance): Promise<{ url: string }> => {
	if (!instance.apiKey) {
		throw new Error("invalid apikey")
	}
	// local docker runtime
	if (MATHOM_RUNTIME === "docker") {
		const res = await fetch(MATHOM_RUNTIME_URL + "/run", {
			method: "POST",
			body: JSON.stringify(instance),
			headers: {
				"Content-Type": "application/json",
				"x-api-key": instance.apiKey,
			},
		}).then((r) => r.json())
		return {
			url: res.url,
		}
	}
	throw new Error("No runtime specified")
}

const createOrUpdateServer = async (
	name: string,
	cmd: string,
	args: string[],
	userId: string,
	runtime: string,
) => {
	const existing = await db
		.select()
		.from(instances)
		.where(and(eq(instances.userId, userId), eq(instances.name, name), eq(instances.args, args)))
		.execute()

	if (existing.length > 0) {
		return existing[0]
	}

	// Create API key for this instance with log creation permissions
	const apiKeyResult = await auth.api.createApiKey({
		body: {
			name: "system",
			userId: userId,
			permissions: {
				logs: ["create"],
			},
		},
	})

	const res = await db
		.insert(instances)
		.values({
			userId,
			runtime,
			name,
			cmd,
			args,
			slug: "",
			status: "pending",
			apiKey: apiKeyResult.key,
		})
		.returning()

	return res[0]
}

const getContainerDetails = async (input: z.infer<typeof RequestInput>) => {
	if (input.cmd) {
		return {
			...input,
			cmd: input.cmd!,
			image: DOCKER_IMAGES.generic,
		}
	}
	// default node
	return {
		...input,
		cmd: "npx",
		image: DOCKER_IMAGES.node,
	}
}
