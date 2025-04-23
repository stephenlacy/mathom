import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/db/drizzle"
import { oauthClients } from "@/db/schema/oauth"
import { eq } from "drizzle-orm"

export async function GET(request: NextRequest) {
	const params = request.nextUrl.searchParams
	const clientId = params.get("clientId")

	if (!clientId) {
		return NextResponse.json(
			{ error: "invalid_request", error_description: "Missing clientId" },
			{ status: 400 },
		)
	}

	try {
		// Look up the client by ID
		const clients = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId))
		const client = clients[0]

		if (!client) {
			return NextResponse.json(
				{ error: "client_not_found", error_description: "Client not found" },
				{ status: 404 },
			)
		}

		// Return client details without sensitive information
		return NextResponse.json(client)
	} catch (error) {
		console.error("Error fetching client details:", error)
		return NextResponse.json(
			{ error: "server_error", error_description: "Internal server error" },
			{ status: 500 },
		)
	}
}
