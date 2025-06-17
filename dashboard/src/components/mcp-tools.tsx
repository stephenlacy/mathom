import { useRef, useState, useCallback, useEffect } from "react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import {
	LucideArrowDown,
	LucideChevronDown,
	LucideChevronRight,
	LucideDot,
	LucideWrench,
} from "lucide-react"
import { cn } from "@/lib/utils"
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
	const toolsContainerRef = useRef<HTMLDivElement>(null)
	const [more, showMore] = useState(false)
	const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

	const checkScrollPosition = useCallback(() => {
		const container = toolsContainerRef.current
		if (!container) return

		const { scrollTop, scrollHeight, clientHeight } = container
		const isScrollable = scrollHeight > clientHeight
		const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 5 // 5px tolerance

		showMore(isScrollable && !isAtBottom)
	}, [])

	const handleScroll = useCallback(
		(e: Event) => {
			checkScrollPosition()
		},
		[checkScrollPosition],
	)

	useEffect(() => {
		const container = toolsContainerRef.current
		if (container) {
			container.addEventListener("scroll", handleScroll)
			return () => container.removeEventListener("scroll", handleScroll)
		}
	}, [handleScroll])

	useEffect(() => {
		// Check scroll position when content changes
		const timeoutId = setTimeout(checkScrollPosition, 100)
		return () => clearTimeout(timeoutId)
	}, [mcpCalls, expandedItems, checkScrollPosition])

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
		<div
			className={cn(
				"relative flex flex-col border-1 border-accent bg-accent/50 h-[600px] max-h-[900px] w-full rounded-sm inset-shadow-md inset-shadow-accent",
				className,
			)}
		>
			{more ? (
				<div className="flex absolute z-10 text-sm text-foreground/50 mt-2 bottom-4 left-0 right-0 items-center justify-center">
					<Button
						variant="secondary"
						className="h-7 rounded-2xl shadow-2xl border-foreground/20 border text-foreground/80"
						onClick={() => {
							toolsContainerRef.current?.scrollTo({
								top: toolsContainerRef.current.scrollHeight,
								behavior: "smooth",
							})
						}}
					>
						More <LucideArrowDown className="ml-1 h-4 w-4" />
					</Button>
				</div>
			) : null}
			<div className="p-4 border-b border-accent">
				<div className="flex items-center justify-between">
					<span>Tools</span>
					<span className="text-xs text-foreground/50">{tools.length} available</span>
				</div>
			</div>
			<div ref={toolsContainerRef} className="overflow-scroll h-full w-full p-4 space-y-2">
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
			</div>
		</div>
	)
}

