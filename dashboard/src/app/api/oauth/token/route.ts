import { type NextRequest, NextResponse } from "next/server"
import { handleTokenRequest } from "@/lib/oauth/helpers"

export async function POST(request: NextRequest) {
	return handleTokenRequest(request)
}

// Add OPTIONS method for CORS preflight requests
export async function OPTIONS() {
	return new NextResponse(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Access-Control-Max-Age": "86400",
		},
	})
}
