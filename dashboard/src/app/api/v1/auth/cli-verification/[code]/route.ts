import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db/drizzle"
import { cliVerifications } from "@/db/schema"
import { eq, and, gt } from "drizzle-orm"

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
	try {
		const { code } = await params

		if (!code || typeof code !== "string" || code.length !== 6) {
			return NextResponse.json({ error: "Invalid code" }, { status: 400 })
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

		const record = verification[0]

		// If verification is completed, return the access token
		if (record.accessToken) {
			return NextResponse.json({ accessToken: record.accessToken })
		}

		// If not completed yet, return empty response (for polling)
		return NextResponse.json({ status: "pending" })
	} catch (error) {
		console.error("Error checking CLI verification:", error)
		return NextResponse.json({ error: "Internal server error" }, { status: 500 })
	}
}
