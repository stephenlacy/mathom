import { useState } from "react"
import { Badge } from "./ui/badge"
import { LucideChevronDown, LucideChevronRight, LucideDot, LucideWrench } from "lucide-react"
import { MoreScrollContainer } from "./ui/more-scroll-container"
import { McpCallGroup } from "@/lib/mcp-parser"

interface Tool {
	name: string
	description: string
	inputSchema?: {
		type: string
		properties?: Record<string, any>
		required?: string[]
		[key: string]: any
	}
}

interface McpToolsProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string
	mcpCalls: McpCallGroup[]
}

export function McpTools({ mcpCalls = [], className }: McpToolsProps) {
	const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

	// Extract tools from MCP calls
	const extractTools = (): Tool[] => {
		for (const call of mcpCalls) {
			if (call.method === "tools/list" && call.response?.result?.tools) {
				return call.response.result.tools
			}
		}
		return []
	}

	const tools = extractTools()

	const toggleExpanded = (index: number) => {
		const newExpanded = new Set(expandedItems)
		if (newExpanded.has(index)) {
			newExpanded.delete(index)
		} else {
			newExpanded.add(index)
		}
		setExpandedItems(newExpanded)
	}

	const formatSchema = (schema: any) => {
		if (!schema) return null
		const { properties, required } = schema
		if (!properties) return null

		return Object.entries(properties).map(([key, prop]: [string, any]) => (
			<div key={key} className="mb-2">
				<div className="flex items-center gap-2">
					<code className="text-xs bg-blue-500/10 px-1 py-0.5 rounded">{key}</code>
					{required?.includes(key) && (
						<Badge className="bg-red-500/20 text-red-400 text-xs px-1 py-0.5 hover:bg-red-500/20">
							required
						</Badge>
					)}
					<span className="text-xs text-foreground/60">{prop.type}</span>
				</div>
				{prop.description && (
					<div className="text-xs text-foreground/50 mt-1 ml-1">{prop.description}</div>
				)}
			</div>
		))
	}

	return (
		<MoreScrollContainer
			className={className}
			containerClassName="space-y-2"
			header={
				<div className="flex items-center justify-between">
					<span>Tools</span>
					<span className="text-xs text-foreground/50">{tools.length} available</span>
				</div>
			}
		>
			{tools.length > 0 ? (
				tools.map((tool, index) => {
					const isExpanded = expandedItems.has(index)
					const hasSchema = tool.inputSchema?.properties

					return (
						<div
							key={index}
							className="border border-accent/50 rounded-md bg-background/50 transition-colors hover:bg-background/80"
						>
							{/* Clickable Header */}
							<div
								className={`flex items-center justify-between p-3 transition-colors ${
									hasSchema ? "cursor-pointer" : "cursor-default"
								}`}
								onClick={hasSchema ? () => toggleExpanded(index) : undefined}
							>
								<div className="flex items-center gap-2">
									{hasSchema ? (
										isExpanded ? (
											<LucideChevronDown className="h-4 w-4 text-foreground/50" />
										) : (
											<LucideChevronRight className="h-4 w-4 text-foreground/50" />
										)
									) : (
										<LucideDot className="h-4 w-4 text-foreground/50" />
									)}
									<LucideWrench className="h-4 w-4 text-blue-400" />
									<div className="flex flex-col">
										<span className="text-sm font-medium">{tool.name}</span>
										{tool.description && (
											<span className="text-xs text-foreground/60">{tool.description}</span>
										)}
									</div>
								</div>
							</div>

							{/* Expandable Content */}
							{hasSchema && isExpanded && (
								<div className="px-3 pb-3 pt-0 border-t border-accent/30">
									<div className="mt-3">
										<div className="text-sm text-foreground/70 mb-2 font-medium">Parameters:</div>
										<div className="space-y-2">{formatSchema(tool.inputSchema)}</div>
									</div>
								</div>
							)}
						</div>
					)
				})
			) : (
				<div className="text-foreground/50 text-sm text-center justify-center items-center flex h-[90%] flex-1">
					No tools available
				</div>
			)}
		</MoreScrollContainer>
	)
}
