import { type NextRequest, NextResponse } from "next/server"
import { handleClientRegistration } from "@/lib/oauth/helpers"

export async function POST(request: NextRequest): Promise<NextResponse> {
	return handleClientRegistration(request)
}

// Add OPTIONS method for CORS preflight requests
export async function OPTIONS(): Promise<NextResponse> {
	return new NextResponse(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Access-Control-Max-Age": "86400",
		},
	})
}
