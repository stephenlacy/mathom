"use client"

import { Button } from "@/components/ui/button"

interface AuthorizeProps {
	clientName: string
	scopes: string[]
	approveAction: (formData: FormData) => void
	denyAction: (formData: FormData) => void
}

export function OauthAuthorize({ clientName, scopes, approveAction, denyAction }: AuthorizeProps) {
	return (
		<main className="flex flex-1 justify-center items-center p-6">
			<div className="flex flex-col justify-center p-8 border-1 bg-accent/20 rounded-md gap-4 max-w-md w-full">
				<h2 className="text-2xl font-semibold">Authorization Request</h2>
				<p className="text-foreground/80">{clientName} is requesting access to your account.</p>

				{scopes.length > 0 && (
					<div className="mt-4">
						<p className="font-medium mb-2">This app will be able to:</p>
						<ul className="list-disc pl-5 space-y-1">
							{scopes.map((scope) => (
								<li key={scope} className="text-sm">
									{scope}
								</li>
							))}
						</ul>
					</div>
				)}

				<div className="flex flex-row gap-4 mt-6">
					<form action={denyAction} method="POST">
						<Button variant="outline" type="submit" className="w-full flex-1">
							Deny
						</Button>
					</form>

					<form action={approveAction} method="POST">
						<Button variant="default" type="submit" className="w-full flex-1">
							Approve
						</Button>
					</form>
				</div>
			</div>
		</main>
	)
}
