import { type NextRequest, NextResponse } from "next/server"
import { auth } from "./lib/auth"
import { headers } from "next/headers"

// This middleware is used to protect API routes
// Not the client-side pages
export async function middleware(request: NextRequest) {
	// Allow anonymous access to CLI verification endpoints
	if (request.nextUrl.pathname.startsWith("/api/v1/auth/cli-verification")) {
		return NextResponse.next()
	}

	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		})

		if (!session?.user) {
			// Return a 401 Unauthorized response
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}
		return NextResponse.next()
	} catch (error: any) {
		if (error?.message.includes("Invalid API key")) {
			return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
		}
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}
}

export const config = {
	matcher: ["/api/v1/:path*"],
}
