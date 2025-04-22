"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useSearchParams } from "next/navigation"
import { authClient } from "../../auth-client"
import { useState } from "react"

export function CliAuth() {
	const params = useSearchParams()
	const [error, setError] = useState<string | null>(null)

	const termCode = params.get("code")
	const termPort = params.get("port")
	const termHostname = params.get("hostname")
	const LOCAL_URL = `http://localhost:${termPort}/auth/callback`

	const login = async () => {
		const res = await authClient.apiKey.create({
			name: `cli:${termHostname}`,
			expiresIn: 60 * 60 * 24 * 30, // 90 days
		})
		if (res.error || !res.data) {
			console.error(res.error)
			setError("Unable to authenticate")
			return
		}

		return fetch(LOCAL_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ access_token: res.data?.key, code: termCode }),
		}).catch((err) => {
			console.error(err)
			setError("Unable to authenticate")
		})
	}

	return (
		<div className="flex flex-1 justify-center items-center">
			<Card>
				<CardContent className="flex flex-col my-6 justify-center items-center min-w-[600px]">
					<Button onClick={login}>Authenticate</Button>
					{error ? <div className="text-red-500 text-sm mt-2">{error}</div> : null}
				</CardContent>
			</Card>
		</div>
	)
}
