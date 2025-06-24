import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

interface VerifyCodeResponse {
	status: "pending" | "verified"
	accessToken?: string
	error?: string
}

interface CompleteAuthResponse {
	success: boolean
	error?: string
}

// Query to verify a CLI code
async function verifyCliCode(code: string): Promise<VerifyCodeResponse> {
	const response = await fetch(`/api/v1/auth/cli-verification/${code}`)

	if (!response.ok) {
		throw new Error("Invalid or expired verification code")
	}

	return response.json()
}

// Mutation to complete CLI authentication
async function completeCliAuth(code: string): Promise<CompleteAuthResponse> {
	const response = await fetch(`/api/v1/auth/cli-verification/${code}/complete`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
	})

	if (!response.ok) {
		const errorData = await response.json()
		throw new Error(errorData.error || "Unable to complete verification")
	}

	return response.json()
}

export function useVerifyCliCode(code: string | null) {
	return useQuery({
		queryKey: ["cli-verification", code],
		queryFn: () => verifyCliCode(code!),
		enabled: !!code,
		retry: false, // Don't retry on invalid codes
		staleTime: 0, // Always check freshness
	})
}

export function useCompleteCliAuth() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: completeCliAuth,
		onSuccess: (data, code) => {
			// Invalidate the verification query after successful completion
			queryClient.invalidateQueries({ queryKey: ["cli-verification", code] })
		},
	})
}
