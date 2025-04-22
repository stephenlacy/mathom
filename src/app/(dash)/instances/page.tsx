import { Button } from "@/components/ui/button"
import { listInstances } from "@/core/instances"
import { getUser } from "@/lib/auth"
import { ExternalLinkIcon } from "lucide-react"

export default async function InstancesPage() {
	const user = await getUser()

	const instances = await listInstances(user.id)
	console.log({ instances })

	return (
		<div className="flex flex-col p-4">
			<div className="flex items-center justify-center">
				<EmptyInstances />
			</div>
		</div>
	)
}

function EmptyInstances() {
	return (
		<div className="flex flex-col justify-center p-8 border-1 bg-accent/20 rounded-md gap-4">
			<h2 className="text-2xl">Welcome!</h2>
			<p className="text-foreground/50">This is your workspace.</p>
			<p className="text-foreground">Launch your first MCP server to get started.</p>

			<div className="bg-accent/20 p-4 rounded-md text-sm font-mono text-foreground/80 border-1 border-solid border-accent">
				<pre>mcx -y my-mcp-server</pre>
			</div>

			<Button className="uppercase">
				View Docs <ExternalLinkIcon className="mb-[2px]" />
			</Button>
		</div>
	)
}
