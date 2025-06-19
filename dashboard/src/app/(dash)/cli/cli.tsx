"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"

export function CliAuth() {
	const params = useSearchParams()
	const router = useRouter()
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [codeValid, setCodeValid] = useState<boolean | null>(null)
	const [isComplete, setIsComplete] = useState(false)

	const termCode = params.get("code")

	// Check if the code is valid on component mount
	useEffect(() => {
		if (!termCode) {
			setCodeValid(false)
			setError("No verification code provided")
			return
		}

		const verifyCode = async () => {
			try {
				const response = await fetch(`/api/v1/auth/cli-verification/${termCode}`)
				if (response.ok) {
					setCodeValid(true)
				} else {
					setCodeValid(false)
					setError("Invalid or expired verification code")
				}
			} catch (err) {
				setCodeValid(false)
				setError("Unable to verify code")
			}
		}

		verifyCode()
	}, [termCode])

	const confirmAuth = () => {
		if (!termCode) return

		setLoading(true)
		setError(null)

		fetch(`/api/v1/auth/cli-verification/${termCode}/complete`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
		})
			.then((updateResponse) => {
				if (!updateResponse.ok) {
					return updateResponse.json().then((errorData) => {
						throw new Error(errorData.error || "Unable to complete verification")
					})
				}
				// Show success message
				setError(null)
				setIsComplete(true)
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : "Authentication failed")
			})
			.finally(() => {
				setLoading(false)
			})
	}

	const cancel = () => {
		// Redirect to the CLI login page
		router.push("/")
	}

	if (codeValid === null) {
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

	if (codeValid === false) {
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
						<Button onClick={confirmAuth} disabled={loading} size="lg">
							{loading ? "Confirming..." : "Confirm"}
						</Button>
					</div>
					{error && <div className="text-red-500 text-sm mt-2 text-center">{error}</div>}
				</CardContent>
			</Card>
		</div>
	)
}
