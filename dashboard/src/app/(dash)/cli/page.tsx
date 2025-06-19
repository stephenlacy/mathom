import { CliAuth } from "./cli"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function CliPage({
	searchParams,
}: {
	searchParams: { code?: string }
}) {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user) {
		// Redirect to sign-in with the CLI parameters preserved
		const params = new URLSearchParams()
		if (searchParams.code) {
			params.set("redirect", `/cli?code=${searchParams.code}`)
		}
		return redirect(`/sign-in?${params.toString()}`)
	}

	return (
		<div className="flex flex-col flex-1 items-center justify-center mt-8">
			<CliAuth />
		</div>
	)
}
