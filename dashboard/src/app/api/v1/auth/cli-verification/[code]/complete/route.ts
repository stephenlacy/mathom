import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db/drizzle"
import { cliVerifications } from "@/db/schema"
import { eq, and, gt } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ code: string }> },
) {
	try {
		const { code } = await params

		if (!code || typeof code !== "string" || code.length !== 6) {
			return NextResponse.json({ error: "Invalid code" }, { status: 400 })
		}

		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const upperCode = code.toUpperCase()

		// Check if verification exists and is not expired
		const verification = await db
			.select()
			.from(cliVerifications)
			.where(and(eq(cliVerifications.code, upperCode), gt(cliVerifications.expiresAt, new Date())))
			.limit(1)

		if (verification.length === 0) {
			return NextResponse.json({ error: "Code not found or expired" }, { status: 404 })
		}

		const apiKeyResult = await auth.api.createApiKey({
			body: {
				name: `cli:${new Date().toISOString()}`,
				userId: session.user.id,
				expiresIn: 60 * 60 * 24 * 90, // 90 days
			},
		})

		if (!apiKeyResult || !apiKeyResult.key) {
			return NextResponse.json({ error: "Failed to create API key" }, { status: 500 })
		}

		await db
			.update(cliVerifications)
			.set({
				accessToken: apiKeyResult.key,
				completed: true,
			})
			.where(and(eq(cliVerifications.code, upperCode), gt(cliVerifications.expiresAt, new Date())))

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error("Error completing CLI verification:", error)
		return NextResponse.json({ error: "Internal server error" }, { status: 500 })
	}
}
