import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "./ui/button"
import {
	LucideArrowDown,
	LucideArrowRight,
	LucideArrowLeft,
	LucideXCircle,
	LucideChevronDown,
	LucideChevronRight,
	LucideDot,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "./ui/badge"
import { McpCall } from "@/lib/mcp-parser"

interface McpCallsProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string
	calls: McpCall[]
}

export function McpCalls({ calls = [], className }: McpCallsProps) {
	const callsContainerRef = useRef<HTMLDivElement>(null)
	const [more, showMore] = useState(false)
	const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

	const checkScrollPosition = useCallback(() => {
		const container = callsContainerRef.current
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
		const container = callsContainerRef.current
		if (container) {
			container.addEventListener("scroll", handleScroll)
			return () => container.removeEventListener("scroll", handleScroll)
		}
	}, [handleScroll])

	useEffect(() => {
		// Check scroll position when content changes
		const timeoutId = setTimeout(checkScrollPosition, 100) // Small delay to ensure DOM is updated
		return () => clearTimeout(timeoutId)
	}, [calls, expandedItems, checkScrollPosition])

	const getCallType = (call: McpCall) => {
		if (call.result) return "response"
		if (call.error) return "error"
		if (call.method) return "request"
		return "unknown"
	}

	const getCallIcon = (type: string) => {
		switch (type) {
			case "request":
				return <LucideArrowRight className="h-4 w-4" />
			case "response":
				return <LucideArrowLeft className="h-4 w-4" />
			case "error":
				return <LucideXCircle className="h-4 w-4" />
			default:
				return null
		}
	}

	const getCallVariant = (type: string) => {
		switch (type) {
			case "request":
				return "default"
			case "response":
				return "secondary"
			case "error":
				return "destructive"
			default:
				return "outline"
		}
	}

	const formatJsonField = (obj: any) => {
		if (!obj) return null
		return JSON.stringify(obj, null, 2)
	}

	const getCallHeader = (call: McpCall) => {
		if (call.method) {
			// For requests/notifications, use the method name
			if (call.method.startsWith("tools/")) {
				return `tool call: ${call.method.replace("tools/", "")}`
			}
			return call.method
		}
		if (call.result) {
			return "response"
		}
		if (call.error) {
			return "error response"
		}
		return "unknown"
	}

	const hasExpandableContent = (call: McpCall) => {
		return !!(call.params || call.result || call.error)
	}

	const toggleExpanded = (index: number) => {
		const newExpanded = new Set(expandedItems)
		if (newExpanded.has(index)) {
			newExpanded.delete(index)
		} else {
			newExpanded.add(index)
		}
		setExpandedItems(newExpanded)
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
							callsContainerRef.current?.scrollTo({
								top: callsContainerRef.current.scrollHeight,
								behavior: "smooth",
							})
						}}
					>
						More <LucideArrowDown className="ml-1 h-4 w-4" />
					</Button>
				</div>
			) : null}
			<div className="p-4 border-b border-accent">History</div>
			<div ref={callsContainerRef} className="overflow-scroll h-full w-full p-4 space-y-2">
				{calls.length > 0 ? (
					calls.map((call, index) => {
						const type = getCallType(call)
						const isExpanded = expandedItems.has(index)
						const header = getCallHeader(call)
						const isExpandable = hasExpandableContent(call)

						return (
							<div
								key={index}
								className="border border-accent/50 rounded-md bg-background/50 transition-colors hover:bg-background/80"
							>
								{/* Clickable Header */}
								<div
									className={`flex items-center justify-between p-3 transition-colors ${
										isExpandable ? "cursor-pointer" : "cursor-default"
									}`}
									onClick={isExpandable ? () => toggleExpanded(index) : undefined}
								>
									<div className="flex items-center gap-2">
										{isExpandable ? (
											isExpanded ? (
												<LucideChevronDown className="h-4 w-4 text-foreground/50" />
											) : (
												<LucideChevronRight className="h-4 w-4 text-foreground/50" />
											)
										) : (
											<LucideDot className="h-4 w-4 text-foreground/50" />
										)}
										<Badge variant={getCallVariant(type) as any} className="gap-1">
											{getCallIcon(type)}
											{type}
										</Badge>
										<span className="font-medium text-sm">{header}</span>
										{call.id !== undefined && (
											<Badge variant="outline" className="font-mono text-xs">
												ID: {String(call.id)}
											</Badge>
										)}
									</div>
									{call.timestamp && (
										<div className="text-xs text-foreground/50 font-mono">
											{new Date(call.timestamp).toLocaleTimeString()}
										</div>
									)}
								</div>

								{/* Expandable Content */}
								{isExpandable && isExpanded && (
									<div className="px-3 pb-3 pt-0 border-t border-accent/30">
										{call.params && (
											<div className="mb-3 mt-3">
												<div className="text-sm text-foreground/70 mb-2 font-medium">
													Parameters:
												</div>
												<pre className="text-xs bg-blue-500/10 border-blue-400/20 p-3 rounded border overflow-x-auto font-mono whitespace-pre-wrap break-words">
													{formatJsonField(call.params)}
												</pre>
											</div>
										)}

										{call.result && (
											<div className="mb-3">
												<div className="text-sm text-foreground/70 mb-2 font-medium">Result:</div>
												<pre className="text-xs bg-blue-500/10 border-blue-400/20 border p-3 rounded overflow-x-auto font-mono whitespace-pre-wrap break-words">
													{formatJsonField(call.result)}
												</pre>
											</div>
										)}

										{call.error && (
											<div className="mb-3">
												<div className="text-sm text-foreground/70 mb-2 font-medium">Error:</div>
												<pre className="text-xs bg-red-400/10 border-red-200/20 border p-3 rounded overflow-x-auto font-mono whitespace-pre-wrap break-words">
													{formatJsonField(call.error)}
												</pre>
											</div>
										)}
									</div>
								)}
							</div>
						)
					})
				) : (
					<div className="text-foreground/50 text-sm text-center justify-center items-center flex h-[90%] flex-1">
						No MCP calls available
					</div>
				)}
			</div>
		</div>
	)
}
