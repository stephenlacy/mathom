"use client"

import { useEffect } from "react"
import { authClient, useSession } from "@/app/auth-client"

export function AutoLogin() {
	const { data: session } = useSession()

	useEffect(() => {
		const autoSignIn = async () => {
			// Check if we're in local mode by checking the hostname
			const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
			
			console.log("Auto-login check:", { isLocal, hasSession: !!session?.user, session })
			
			// Only auto-sign in in local mode and if not already authenticated
			if (isLocal && !session?.user) {
				try {
					console.log("Auto-signing in persistent local user for development...")
					const response = await fetch('/api/auth/local-anonymous', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
					})
					
					if (response.ok) {
						const result = await response.json()
						console.log("Local auto-login result:", result)
						// Refresh the page to load the new session
						window.location.reload()
					} else {
						console.error("Local auto-login failed:", response.status)
					}
				} catch (error) {
					console.error("Auto-login failed:", error)
				}
			}
		}

		// Only run if session data is available (not loading)
		if (session !== undefined) {
			const timeoutId = setTimeout(autoSignIn, 100)
			return () => clearTimeout(timeoutId)
		}
	}, [session])

	return null
}