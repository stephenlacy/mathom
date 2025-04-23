import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { OauthAuthorize } from "./authorize"
import { lookupClient } from "@/lib/oauth/helpers"
import { db } from "@/db/drizzle"

function parseParams(searchParams: { [key: string]: string | string[] | undefined }) {
	// Helper to extract string values
	const getParam = (key: string): string | undefined => {
		const value = searchParams[key]
		return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined
	}

	return {
		responseType: getParam("response_type"),
		clientId: getParam("client_id"),
		redirectUri: getParam("redirect_uri"),
		scope: getParam("scope"),
		state: getParam("state"),
		codeChallenge: getParam("code_challenge"),
		codeChallengeMethod: getParam("code_challenge_method"),
	}
}

export default async function AuthorizePage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
	// Get current user session
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	const searchParamValues = await searchParams

	// Redirect to login if not authenticated
	if (!session?.user) {
		const returnTo = `/oauth/authorize?${new URLSearchParams(searchParamValues as Record<string, string>)}`
		return redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`)
	}

	const params = parseParams(searchParamValues)

	// Prepare URL for API authorization endpoint
	const apiParams = new URLSearchParams()
	Object.entries(params).forEach(([key, value]) => {
		if (value) apiParams.set(key, value)
	})

	const approveUrl = `/api/oauth/authorize?${apiParams.toString()}`

	// Prepare URL for rejection
	let rejectUrl = "/"
	if (params.redirectUri) {
		try {
			const errorUrl = new URL(params.redirectUri)
			errorUrl.searchParams.set("error", "access_denied")
			errorUrl.searchParams.set("error_description", "The user denied the authorization request")
			if (params.state) {
				errorUrl.searchParams.set("state", params.state)
			}
			rejectUrl = errorUrl.toString()
		} catch (e) {
			console.error("Invalid redirect URI:", e)
		}
	}

	// Get client information
	let clientName = "Unknown Application"
	let scopes: string[] = []

	if (params.clientId) {
		try {
			const client = await lookupClient(params.clientId)
			if (client) {
				clientName = client.clientName || `Client ${params.clientId}`
			}
		} catch (error) {
			console.error("Error fetching client:", error)
		}
	}

	// Parse scopes
	if (params.scope) {
		scopes = params.scope.split(" ")
	}

	// For client-side navigation
	async function handleApprove() {
		"use server"
		return redirect(approveUrl)
	}

	async function handleDeny() {
		"use server"
		return redirect(rejectUrl)
	}

	return (
		<OauthAuthorize
			clientName={clientName}
			scopes={scopes}
			approveAction={handleApprove}
			denyAction={handleDeny}
		/>
	)
}
