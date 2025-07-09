import { type NextRequest, NextResponse } from "next/server"
import { auth } from "./lib/auth"
import { headers } from "next/headers"

async function getSession() {
	return auth.api.getSession({ headers: await headers() })
}

function createSignInRedirect(request: NextRequest, pathname: string) {
	const signInUrl = new URL("/sign-in", request.url)
	signInUrl.searchParams.set("redirectTo", pathname)
	return NextResponse.redirect(signInUrl)
}

function handleApiRoute(session: any, error?: any) {
	if (error?.message?.includes("Invalid API key")) {
		return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
	}
	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}
	return NextResponse.next()
}

async function handleApiRoutes(request: NextRequest, pathname: string) {
	// Allow all API routes to handle their own authentication
	return NextResponse.next()
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl

	// Handle CORS for all API routes
	if (pathname.startsWith("/api/")) {
		// Handle preflight requests
		if (request.method === "OPTIONS") {
			return new NextResponse(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
					"Access-Control-Max-Age": "86400",
				},
			})
		}

		// Add CORS headers to all API responses
		const response = await handleApiRoutes(request, pathname)
		response.headers.set("Access-Control-Allow-Origin", "*")
		response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		response.headers.set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization, mcp-protocol-version",
		)
		return response
	}

	// Handle page routes
	const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")
	const isProtectedRoute = pathname.startsWith("/dash") || pathname === "/"

	try {
		const session = await getSession()
		const isAuthenticated = !!session?.user

		// Redirect authenticated users away from auth pages
		if (isAuthenticated && isAuthPage) {
			const redirectTo = request.nextUrl.searchParams.get("redirectTo")
			const destination = redirectTo?.startsWith("/") ? redirectTo : "/"
			return NextResponse.redirect(new URL(destination, request.url))
		}

		// Redirect unauthenticated users to sign-in for protected routes
		if (!isAuthenticated && isProtectedRoute) {
			return createSignInRedirect(request, pathname)
		}

		return NextResponse.next()
	} catch (error) {
		// If auth check fails, redirect to sign-in for protected routes
		if (isProtectedRoute) {
			return createSignInRedirect(request, pathname)
		}
		return NextResponse.next()
	}
}

export const config = {
	matcher: ["/api/:path*", "/", "/dash/:path*", "/sign-in", "/sign-up"],
}
