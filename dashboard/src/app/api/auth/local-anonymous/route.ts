import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db/drizzle"
import { users, sessions } from "@/db/schema/auth"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { typeid } from "typeid-js"

// Generate a consistent TypeID for local development  
const LOCAL_USER_ID = "user_01hjd000000000000000000000"
const LOCAL_USER_EMAIL = "local@anonymous.dev"

export async function POST(request: NextRequest) {
	// Only allow in local mode
	if (process.env.MODE !== "local") {
		return NextResponse.json({ error: "Not available" }, { status: 404 })
	}

	try {
		// Check if local user already exists
		let localUser = await db.query.users.findFirst({
			where: eq(users.id, LOCAL_USER_ID)
		})

		if (!localUser) {
			// Create the consistent local user
			const [newUser] = await db.insert(users).values({
				id: LOCAL_USER_ID,
				name: "Local Developer",
				email: LOCAL_USER_EMAIL,
				emailVerified: true,
				isAnonymous: true,
			}).returning()
			localUser = newUser
		}

		// Create a new session for this user
		const sessionToken = crypto.randomUUID()
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

		const [newSession] = await db.insert(sessions).values({
			userId: LOCAL_USER_ID,
			token: sessionToken,
			expiresAt,
			ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
			userAgent: request.headers.get('user-agent') || 'unknown',
		}).returning()

		// Set the session cookie
		const response = NextResponse.json({
			user: localUser,
			session: newSession
		})

		response.cookies.set('runreal.session-token', sessionToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60, // 7 days
			path: '/'
		})

		return response
	} catch (error) {
		console.error("Error creating local anonymous session:", error)
		return NextResponse.json({ error: "Internal server error" }, { status: 500 })
	}
}