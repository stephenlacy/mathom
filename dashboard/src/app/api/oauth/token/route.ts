import { type NextRequest, NextResponse } from "next/server"
import { handleTokenRequest } from "@/lib/oauth/helpers"

export async function POST(request: NextRequest) {
	const res = await handleTokenRequest(request)
	// console.log("Token request response:", await res.json())
	return res
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
