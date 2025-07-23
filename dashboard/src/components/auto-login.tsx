"use client"

import { useEffect } from "react"
import { authClient, useSession } from "@/app/auth-client"
import { config } from "@/lib/config"
import { toast } from "sonner"

export function AutoLogin() {
	const { data: session } = useSession()

	useEffect(() => {
		const autoSignIn = async () => {
			// Only auto-sign in in local mode and if not already authenticated
			if (config.isLocal && !session?.user) {
				try {
					console.log("Auto-signing in persistent local user for development...")
					await authClient.signIn.anonymous()
				} catch (error) {
					toast.error("Auto-login failed", {
						description: error instanceof Error ? error.message : "Unknown error occurred",
					})
				}
			}
		}

		if (session !== undefined) {
			const timeoutId = setTimeout(autoSignIn, 500)
			return () => clearTimeout(timeoutId)
		}
	}, [session])

	return null
}
