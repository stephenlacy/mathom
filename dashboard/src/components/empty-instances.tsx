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
				{typeof window !== "undefined" && window.location.hostname === "localhost" && (
					<div className="bg-blue-500/10 border border-blue-400/20 p-4 rounded-md">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-2 h-2 bg-blue-400 rounded-full"></div>
							<span className="text-sm font-semibold text-blue-400">Local Mode</span>
						</div>
						<p className="text-sm text-foreground/80 mb-3">
							Set this environment variable before running mcx:
						</p>
						<div className="bg-background/50 p-3 rounded border border-blue-400/20">
							<pre className="text-sm font-mono text-foreground">
								MATHOM_URL=http://localhost:5050
							</pre>
						</div>
						<p className="text-xs text-foreground/60 my-2">
							This connects mcx to your local instance.
							<br />
							Usage:
						</p>
						<div className="bg-background/50 p-3 rounded border border-blue-400/20">
							<pre className="text-sm font-mono text-foreground">
								export MATHOM_URL=http://localhost:5050{"\n"}mcx -y my-mcp-server
							</pre>
						</div>
					</div>
				)}
				{first && (
					<div className="bg-green-500/10 border border-green-400/20 p-3 rounded-md">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-2 h-2 bg-green-400 rounded-full"></div>
							<span className="text-sm font-semibold text-green-400">Install mcx CLI</span>
						</div>
						<div className="bg-background/50 p-2 rounded border border-green-400/20">
							<code className="text-sm font-mono text-foreground">npm i -g mcx</code>
						</div>
					</div>
				)}

				{first && (
					<div className="bg-purple-500/10 border border-purple-400/20 p-3 rounded-md">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-2 h-2 bg-purple-400 rounded-full"></div>
							<span className="text-sm font-semibold text-purple-400">Authenticate</span>
						</div>
						<div className="bg-background/50 p-2 rounded border border-purple-400/20">
							<code className="text-sm font-mono text-foreground">mcx auth login</code>
						</div>
					</div>
				)}

				{first && (
					<div className="bg-orange-500/10 border border-orange-400/20 p-3 rounded-md">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-2 h-2 bg-orange-400 rounded-full"></div>
							<span className="text-sm font-semibold text-orange-400">Launch Server</span>
						</div>
						<div className="bg-background/50 p-2 rounded border border-orange-400/20">
							<code className="text-sm font-mono text-foreground">mcx -y my-mcp-server</code>
						</div>
					</div>
				)}

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
						{typeof window !== "undefined" && window.location.hostname === "localhost"
							? `{
  mcpServers: {
    myMCPServer: {
      command: "mcx",
      args: ["-y", ${instance ? `"${instance.name}"` : `"my-mcp-server"`}],
      env: {
        "MATHOM_URL": "http://localhost:5050"
      }
    }
  }
}`
							: `{
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

				{/* <div className="flex items-center justify-center"> */}
				{/* 	<Button className="uppercase"> */}
				{/* 		View Docs <ExternalLinkIcon className="mb-[2px]" /> */}
				{/* 	</Button> */}
				{/* </div> */}
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
