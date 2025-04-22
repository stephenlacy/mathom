import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"

interface OAuthQueryParams {
	response_type?: string
	client_id?: string
	code_challenge?: string
	code_challenge_method?: string
	redirect_uri?: string
}

export default async function OauthAuthorize({ searchParams }: { searchParams: OAuthQueryParams }) {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user) {
		return redirect("/sign-in")
	}

	const approve = async () => {}
	const reject = async () => {}

	return (
		<main className="flex flex-1 flex-row font-[family-name:var(--font-geist-mono)]">
			<div className="flex flex-col justify-center p-8 border-1 bg-accent/20 rounded-md gap-4">
				<h2 className="text-2xl">Authorization Request</h2>
				<p className="text-foreground/50">This is your workspace.</p>
				<p className="text-foreground">Launch your first MCP server to get started.</p>

				<div className="bg-accent/20 p-4 rounded-md text-sm font-mono text-foreground/80 border-1 border-solid border-accent">
					<pre>mcx -y my-mcp-server</pre>
				</div>

				<Button variant="default" className="uppercase" onClick={() => approve()}>
					Approve
				</Button>
				<Link href={searchParams.redirect_uri || "/"}>
					<Button variant="destructive" className="uppercase">
						Reject
					</Button>
				</Link>
			</div>
		</main>
	)
}
