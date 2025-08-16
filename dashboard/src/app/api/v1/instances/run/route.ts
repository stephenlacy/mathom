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
	node: process.env.NODE_DOCKER_IMAGE || "ghcr.io/stephenlacy/mathom/mathom-proxy:main",
}

const RequestInput = z.object({
	name: z.string(),
	cmd: z.string().optional(),
	args: z.array(z.string()).optional().default([]),
	runtime: z.enum(["node", "python", "bash"]).optional(),
	image: z.string().optional(),
	env: z.record(z.string(), z.string()).optional(),
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

		let body
		try {
			const contentLength = req.headers.get("content-length")
			if (contentLength === "0" || !contentLength) {
				return NextResponse.json({ error: "Empty request body" }, { status: 400 })
			}
			body = await req.json()
		} catch (jsonError) {
			return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
		}

		let parsedInput
		try {
			parsedInput = RequestInput.parse(body)
		} catch (parseError) {
			console.error("Zod parse error:", parseError)
			return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
		}

		const { name, image, cmd, args, env } = await getContainerDetails(parsedInput)

		const server = await createOrUpdateServer(name, cmd, args, session.user.id, image, env)

		const run = await getRuntime(server).catch((e) => {
			console.error("getRuntime error:", e)
			return null
		})

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
	env?: Record<string, string>,
) => {
	const existing = await db
		.select()
		.from(instances)
		.where(and(eq(instances.userId, userId), eq(instances.name, name), eq(instances.args, args)))
		.execute()

	if (existing.length > 0) {
		// Compare env to see if it changed
		const existingEnv = existing[0].env as Record<string, string> | null
		const envChanged = JSON.stringify(existingEnv || {}) !== JSON.stringify(env || {})

		if (envChanged) {
			const updated = await db
				.update(instances)
				.set({ env: env || {} })
				.where(eq(instances.id, existing[0].id))
				.returning()
			return updated[0]
		}
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
			env: env || undefined,
			slug: "",
			status: "pending",
			apiKey: apiKeyResult.key,
		})
		.returning()

	return res[0]
}

const getContainerDetails = async (input: z.infer<typeof RequestInput>) => {
	// if image is provided
	if (input.image) {
		return {
			...input,
			cmd: input.cmd || "",
		}
	}
	// binaries like npx, uvx
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
