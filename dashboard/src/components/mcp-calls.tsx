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
	LucideCheck,
	LucideX,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "./ui/badge"
import { McpCall, McpCallGroup } from "@/lib/mcp-parser"

interface McpCallsProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string
	calls: McpCallGroup[]
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

	const getCallType = (group: McpCallGroup) => {
		if (group.error) return "error"
		if (group.response) return "success"
		if (group.request) {
			// Check if this is a notification (starts with notifications/ or has no id expectation)
			if (group.method?.startsWith("notifications/") || typeof group.id === "string") {
				return "success" // Notifications are complete when sent
			}
			return "pending"
		}
		return "unknown"
	}

	const getCallIcon = (type: string) => {
		switch (type) {
			case "success":
				return <LucideCheck className="h-4 w-4" />
			case "error":
				return <LucideX className="h-4 w-4" />
			case "pending":
				return <LucideDot className="h-4 w-4" />
			default:
				return null
		}
	}

	const getCallVariant = (type: string) => {
		switch (type) {
			case "success":
				return "default"
			case "error":
				return "destructive"
			case "pending":
				return "secondary"
			default:
				return "outline"
		}
	}

	const formatJsonField = (obj: any) => {
		if (!obj) return null
		return JSON.stringify(obj, null, 2)
	}

	const getCallHeader = (group: McpCallGroup) => {
		if (group.method) {
			// For tool calls, use the tool name from parameters
			if (group.method.startsWith("tools/")) {
				const toolName = group.request?.params?.name || group.method.replace("tools/", "")
				return (
					<span className="flex items-center gap-2">
						<Badge className="bg-accent text-foreground border-border text-xs px-2 py-1 hover:bg-accent/30">
							tool call
						</Badge>
						{toolName}
					</span>
				)
			}
			// For notifications, show a cleaner format
			if (group.method.startsWith("notifications/")) {
				return (
					<span className="flex items-center gap-2">
						<Badge className="bg-accent text-foreground border-border text-xs px-2 py-1 hover:bg-accent/30">
							notification
						</Badge>
						{group.method.replace("notifications/", "")}
					</span>
				)
			}
			return (
				<span className="flex items-center gap-2">
					<Badge className="bg-accent text-foreground border-border text-xs px-2 py-1 hover:bg-accent/30">
						{group.method}
					</Badge>
				</span>
			)
		}
		if (group.error) {
			return "error response"
		}
		return "unknown"
	}

	const hasExpandableContent = (group: McpCallGroup) => {
		return !!(group.request?.params || group.response?.result || group.error?.error)
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

	// Calculate statistics
	const stats = {
		total: calls.length,
		error: calls.filter((call) => getCallType(call) === "error").length,
		success: calls.filter((call) => getCallType(call) === "success").length,
		pending: calls.filter((call) => getCallType(call) === "pending").length,
	}

	const errorRate = stats.total > 0 ? ((stats.error / stats.total) * 100).toFixed(1) : "0.0"
	const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : "0.0"

	return (
		<div
			className={cn(
				"relative flex flex-col border-1 border-accent bg-accent/50 h-[600px] max-h-[900px] w-full rounded-sm inset-shadow-md inset-shadow-accent",
				className,
			)}
		>
			{more ? (
				<div className="flex absolute z-10 text-sm text-foreground/50 mt-2 bottom-12 left-0 right-0 items-center justify-center">
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
					calls.map((group, index) => {
						const type = getCallType(group)
						const isExpanded = expandedItems.has(index)
						const header = getCallHeader(group)
						const isExpandable = hasExpandableContent(group)

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
										<Badge
											className={`gap-0 px-2 py-1 w-8 h-8 rounded-full justify-center items-center text-sm transition-colors bg-transparent hover:bg-transparent ${
												type === "error"
													? "text-red-400"
													: type === "success"
														? "text-green-400"
														: type === "pending"
															? "text-yellow-400"
															: " text-gray-400"
												// type === "error"
												// 	? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
												// 	: type === "success"
												// 		? "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30"
												// 		: type === "pending"
												// 			? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30"
												// 			: "bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30"
											}`}
										>
											{getCallIcon(type)}
										</Badge>
										<span className="text-sm">{header}</span>
									</div>
									{group.id !== undefined && typeof group.id !== "string" && (
										<Badge
											variant="outline"
											className="font-mono text-sm bg-acc border-border justify-center ml-auto mr-2"
										>
											ID: {String(group.id)}
										</Badge>
									)}
									{group.timestamp && (
										<div className="text-sm text-foreground/50 font-mono">
											{new Date(group.timestamp).toLocaleTimeString()}
										</div>
									)}
								</div>

								{/* Expandable Content */}
								{isExpandable && isExpanded && (
									<div className="px-3 pb-3 pt-0 border-t border-accent/30">
										{/* Request */}
										{group.request && (
											<div className="mb-3 mt-3">
												<div className="text-sm text-foreground/70 mb-2 font-medium flex items-center gap-2">
													<LucideArrowRight className="h-3 w-3" />
													Request:
												</div>
												{group.request.params && (
													<div className="mb-2">
														<pre className="text-sm bg-blue-500/10 border-blue-400/20 p-3 rounded border overflow-x-auto font-mono whitespace-pre-wrap break-words">
															{formatJsonField(group.request.params)}
														</pre>
													</div>
												)}
											</div>
										)}

										{/* Response */}
										{group.response && (
											<div className="mb-3">
												<div className="text-sm text-foreground/70 mb-2 font-medium flex items-center gap-2">
													<LucideArrowLeft className="h-3 w-3" />
													Response:
												</div>
												<pre className="text-sm bg-green-500/10 border-green-400/20 border p-3 rounded overflow-x-auto font-mono whitespace-pre-wrap break-words">
													{formatJsonField(group.response.result)}
												</pre>
											</div>
										)}

										{/* Error */}
										{group.error && (
											<div className="mb-3">
												<div className="text-sm text-foreground/70 mb-2 font-medium flex items-center gap-2">
													<LucideXCircle className="h-3 w-3" />
													Error:
												</div>
												<pre className="text-sm bg-red-400/10 border-red-200/20 border p-3 rounded overflow-x-auto font-mono whitespace-pre-wrap break-words">
													{formatJsonField(group.error.error)}
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

			{/* Footer */}
			<div className="p-4 border-t border-accent bg-accent/30">
				<div className="flex items-center justify-between text-sm">
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-red-400"></div>
							<span className="text-foreground/70">
								Error Rate: {stats.error} ({errorRate}%)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-green-400"></div>
							<span className="text-foreground/70">
								Success Rate: {stats.success} ({successRate}%)
							</span>
						</div>
					</div>
					<div className="text-foreground/50">Total: {stats.total} calls</div>
				</div>
			</div>
		</div>
	)
}
