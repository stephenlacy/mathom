"use client"

import { Button } from "@/components/ui/button"
import { Instance } from "@/db/schema"
import { cn } from "@/lib/utils"
import { ExternalLinkIcon } from "lucide-react"
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
	const title = first ? "Launch your first MCP server:" : "Launch another MCP server:"

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
					<div className="p-4">
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
								? `mcx auth login \nmcx -y my-mcp-server`
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
      args: ["-y", ${instance ? `"${instance.name}"` : `"my-mcp-server"`}],
    },
  },
}`}
					</pre>
				</div>

				<Button className="uppercase">
					View Docs <ExternalLinkIcon className="mb-[2px]" />
				</Button>
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
