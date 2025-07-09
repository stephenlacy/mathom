"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Instance } from "@/db/schema"
import { cn } from "@/lib/utils"
import { ExternalLinkIcon, Copy } from "lucide-react"
import { useState } from "react"

const clientConfig = {
	claude: "~/Library/Application Support/Claude/claude_desktop_config.json",
	cursor: "~/.cursor/mcp.json",
	windsurf: "~/.codeium/windsurf/mcp_config.json",
}

export function EmptyInstances({
	first,
	instance,
	className,
	...rest
}: { first: boolean; instance?: Partial<Instance> } & React.HTMLAttributes<HTMLDivElement>) {
	const [activeTab, setActiveTab] = useState<"cursor" | "windsurf" | "claude">("claude")
	const [copied, setCopied] = useState(false)
	const title = first ? "Launch your first MCP server:" : "Launch another MCP server:"

	const endpoint = instance?.id
		? `${process.env.NEXT_PUBLIC_MATHOM_RUNTIME_URL}/mcp/${instance.id}`
		: null

	const copyEndpoint = async () => {
		if (endpoint) {
			await navigator.clipboard.writeText(endpoint)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}

	return (
		<div
			className={cn(
				"flex flex-col border-1 bg-accent/50 border-accent rounded-md min-w-[600px]",
				className,
			)}
			{...rest}
		>
			{instance ? (
				<>
					<div className="p-4 border-b border-accent">Connect to your server:</div>
				</>
			) : (
				<>
					<div className="p-4 border-b border-accent text-foreground/80 font-bold">
						This is your workspace
					</div>
					<div className="p-4 pb-0">
						<p className="text-foreground">{title}</p>
					</div>
				</>
			)}

			<div className="flex flex-col p-4 gap-4">
				<div className="bg-accent/80 p-4 rounded-md text-sm font-mono text-foreground/80 border-1 border-solid border-accent">
					<pre>
						{instance
							? `mcx -y ${instance.name}`
							: first
								? `npm i -g mcx\nmcx auth login\nmcx -y my-mcp-server`
								: `mcx -y my-mcp-server`}
					</pre>
				</div>

				<div className="flex gap-2">
					<ClientTab
						client={"Claude"}
						active={activeTab === "claude"}
						onClick={() => setActiveTab("claude")}
					/>
					<ClientTab
						client={"Cursor"}
						active={activeTab === "cursor"}
						onClick={() => setActiveTab("cursor")}
					/>
					<ClientTab
						client={"Windsurf"}
						active={activeTab === "windsurf"}
						onClick={() => setActiveTab("windsurf")}
					/>
				</div>

				<div className="border-t pt-4 text-xs">
					Update <span className="bg-accent px-1 rounded-xs">{clientConfig[activeTab]}</span>
				</div>
				<div className="bg-background p-4 rounded-md text-sm font-mono text-foreground/80 border-1 border-solid border-border/50">
					<pre className="whitespace-pre-wrap break-words">
						{`{
  mcpServers: {
    myMCPServer: {
      command: "mcx",
      args: ["-y", ${instance ? `"${instance.name}"` : `"my-mcp-server"`}]
    }
  }
}`}
					</pre>
				</div>

				{instance && endpoint && (
					<div className="border-t pt-4">
						<div className="text-xs text-foreground/60 mb-2">Server Endpoint:</div>
						<div className="bg-background p-3 rounded-md border-1 border-border/50 flex items-center justify-between">
							<code className="text-sm font-mono text-foreground/80 break-all">{endpoint}</code>
							<Tooltip open={copied}>
								<TooltipTrigger asChild>
									<Button
										variant="secondary"
										size="sm"
										className="ml-3 h-8 w-8 p-0 hover:bg-accent flex-shrink-0"
										onClick={copyEndpoint}
									>
										<Copy className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Copied!</TooltipContent>
							</Tooltip>
						</div>
					</div>
				)}

				<div className="flex items-center justify-center">
					<Button className="uppercase">
						View Docs <ExternalLinkIcon className="mb-[2px]" />
					</Button>
				</div>
			</div>
		</div>
	)
}

function ClientTab({
	active,
	client,
	...rest
}: { active: boolean; client: string } & React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex flex-col p-1 flex-1 rounded-sm cursor-pointer border-1 border-transparent",
				active && "border-1 border-border",
			)}
			{...rest}
		>
			<div className="flex flex-col bg-accent/80 border-1 border-border/50 rounded-xs">
				<div className="flex justify-between p-2 px-3 border-b border-b-accent items-center">
					<div className="text-sm font-semibold">{client}</div>
					<div>{active && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}</div>
				</div>
			</div>
		</div>
	)
}
