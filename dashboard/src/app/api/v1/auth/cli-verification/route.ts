import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db/drizzle"
import { cliVerifications } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function POST(request: NextRequest) {
	try {
		const { code } = await request.json()

		if (!code || typeof code !== "string" || code.length !== 6) {
			return NextResponse.json({ error: "Invalid code" }, { status: 400 })
		}

		const upperCode = code.toUpperCase()

		await db.insert(cliVerifications).values({
			code: upperCode,
			createdAt: new Date(),
			expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
		})

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error("Error creating CLI verification:", error)
		return NextResponse.json({ error: "Internal server error" }, { status: 500 })
	}
}
