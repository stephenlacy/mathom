"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSearchParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useVerifyCliCode, useCompleteCliAuth } from "@/hooks/use-cli-auth"

export function CliAuth() {
	const params = useSearchParams()
	const router = useRouter()
	const [isComplete, setIsComplete] = useState(false)

	const termCode = params.get("code")

	// Use React Query to verify the code
	const { 
		data: verifyData, 
		isLoading: isVerifying, 
		error: verifyError 
	} = useVerifyCliCode(termCode)

	// Use React Query mutation for completing authentication
	const completeAuthMutation = useCompleteCliAuth()

	const confirmAuth = () => {
		if (!termCode) return

		completeAuthMutation.mutate(termCode, {
			onSuccess: () => {
				setIsComplete(true)
			},
		})
	}

	const cancel = () => {
		// Redirect to the CLI login page
		router.push("/")
	}

	// Handle loading state
	if (isVerifying) {
		return (
			<div className="flex flex-1 justify-center items-center mb-100">
				<Card>
					<CardContent className="flex flex-col my-6 justify-center items-center min-w-[600px]">
						<div className="text-foreground-500">Verifying code...</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Handle error state
	if (verifyError || !termCode) {
		return (
			<div className="flex flex-1 justify-center items-center mb-100">
				<Card>
					<CardHeader>
						<CardTitle className="text-center text-red-600">
							{termCode ? "Invalid Code" : "No Code Provided"}
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col my-6 justify-center items-center min-w-[600px]">
						<div className="text-sm text-muted-foreground mb-4">
							{termCode
								? "The verification code is invalid or has expired."
								: "No verification code was provided in the URL"}
						</div>
						<div className="text-muted-foreground">
							Please run <code className="bg-accent p-1 px-2 rounded">mcx auth login</code> from
							your terminal
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	if (isComplete) {
		return (
			<div className="flex flex-1 justify-center items-center mb-100">
				<Card>
					<CardHeader>
						<CardTitle className="text-center text-green-600">Authentication Complete</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col my-6 justify-center items-center min-w-[600px]">
						<div className="text-muted-foreground text-center mb-4">
							Your CLI has been successfully authenticated!
						</div>
						<div className="text-xs text-gray-400 text-center">
							You can now close this window and return to your terminal.
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="flex flex-1 justify-center items-center mb-100">
			<Card>
				<CardHeader>
					<CardTitle className="text-center">CLI Authentication</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col my-6 justify-center items-center min-w-[600px]">
					<div className="text-muted-foreground mb-4 text-center">
						Confirm this is the code displayed in your terminal:
						<div className="flex gap-2 justify-center items-center mt-2">
							{termCode?.split("").map((char, index) => (
								<code
									key={`${char}-${index}`}
									className="bg-accent px-3 py-2 rounded font-mono text-xl text-foreground"
								>
									{char}
								</code>
							))}
						</div>
					</div>
					<div className="flex gap-4 justify-center items-center mt-6">
						<Button variant="secondary" onClick={cancel} size="lg">
							Cancel
						</Button>
						<Button 
							onClick={confirmAuth} 
							disabled={completeAuthMutation.isPending} 
							size="lg"
						>
							{completeAuthMutation.isPending ? "Confirming..." : "Confirm"}
						</Button>
					</div>
					{completeAuthMutation.error && (
						<div className="text-red-500 text-sm mt-2 text-center">
							{completeAuthMutation.error instanceof Error 
								? completeAuthMutation.error.message 
								: "Authentication failed"
							}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
