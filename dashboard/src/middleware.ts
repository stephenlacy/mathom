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

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl

	// Allow anonymous access to CLI verification endpoints
	if (pathname.startsWith("/api/v1/auth/cli-verification")) {
		return NextResponse.next()
	}

	// Handle API routes
	if (pathname.startsWith("/api/v1/")) {
		try {
			const session = await getSession()
			return handleApiRoute(session)
		} catch (error: any) {
			return handleApiRoute(null, error)
		}
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
	matcher: ["/api/v1/:path*", "/", "/dash/:path*", "/sign-in", "/sign-up"],
}
