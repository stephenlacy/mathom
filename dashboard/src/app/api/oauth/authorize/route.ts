import { type NextRequest, NextResponse } from "next/server"
import {
	parseAuthRequest,
	validateAuthorizationRequest,
	createErrorRedirect,
	completeAuthorization,
} from "@/lib/oauth/helpers"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function GET(request: NextRequest) {
	try {
		// Parse the authorization request parameters
		const authRequest = await parseAuthRequest(request)

		// Get the current user session
		const session = await auth.api.getSession({
			headers: await headers(),
		})

		// If no session, redirect to login with return URL
		if (!session || !session.user?.id) {
			// Create the return URL with all OAuth parameters preserved
			const url = new URL(request.url)
			const returnTo = url.pathname + url.search

			// Encode the return URL and redirect to login
			const loginUrl = new URL("/sign-in", request.url)
			loginUrl.searchParams.set("returnTo", returnTo)

			return NextResponse.redirect(loginUrl.toString())
		}

		// User is authenticated, get their ID
		const userId = session.user.id

		// Validate the authorization request
		const validation = await validateAuthorizationRequest(authRequest, session.user)
		if (!validation.isValid) {
			// If redirect URI is valid, redirect with error
			if (authRequest.redirectUri) {
				const errorRedirect = createErrorRedirect(
					authRequest.redirectUri,
					validation.error || "server_error",
					validation.description,
					authRequest.state,
				)
				return NextResponse.redirect(errorRedirect)
			}

			// Otherwise, respond with JSON error
			return NextResponse.json(
				{
					error: validation.error || "server_error",
					error_description: validation.description,
				},
				{ status: 400 },
			)
		}

		// Complete the authorization by generating a code and creating a grant
		const result = await completeAuthorization({
			request: authRequest,
			userId,
			metadata: {
				authorized_at: new Date().toISOString(),
				client_id: authRequest.clientId,
			},
			scope: authRequest.scope,
			props: {
				user_id: userId,
				scope: authRequest.scope,
				// Add any other user properties you want to include with the access token
			},
		})

		// Redirect to the client with the authorization code
		return NextResponse.redirect(result.redirectTo)
	} catch (error) {
		console.error("Error in OAuth authorization endpoint:", error)
		return NextResponse.json(
			{
				error: "server_error",
				error_description: "An unexpected error occurred",
			},
			{ status: 500 },
		)
	}
}

// Also implement POST to handle form submissions for authorization
export async function POST(request: NextRequest) {
	// For form-based authorization approvals
	return GET(request)
}
