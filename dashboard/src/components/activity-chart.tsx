import { McpCallGroup } from "@/lib/mcp-parser"
import { useState } from "react"

interface ActivityChartProps {
	mcpCalls: McpCallGroup[]
}

interface TooltipData {
	x: number
	y: number
	successValue: number
	errorValue: number
	time: string
}

export function ActivityChart({ mcpCalls }: ActivityChartProps) {
	const [tooltip, setTooltip] = useState<TooltipData | null>(null)

	// Prepare activity data for the line graph
	const prepareActivityData = () => {
		if (!mcpCalls || mcpCalls.length === 0)
			return { successData: [], errorData: [], bucketSize: "minute" }

		// Determine time range and bucket size
		const timestamps = mcpCalls.map((call) => new Date(call.timestamp).getTime())
		const minTime = Math.min(...timestamps)
		const maxTime = Math.max(...timestamps)
		const timeRange = maxTime - minTime

		// Choose bucket size based on time range and number of requests
		const totalRequests = mcpCalls.length
		const bucketSize = timeRange > 3600000 || totalRequests > 100 ? "hour" : "minute" // 1 hour in ms
		const bucketDuration = bucketSize === "hour" ? 3600000 : 60000 // 1 hour or 1 minute in ms

		// Create buckets
		const buckets = new Map()
		const startTime = Math.floor(minTime / bucketDuration) * bucketDuration
		const endTime = Math.ceil(maxTime / bucketDuration) * bucketDuration

		// Initialize buckets
		for (let time = startTime; time <= endTime; time += bucketDuration) {
			buckets.set(time, { success: 0, error: 0 })
		}

		// Fill buckets with data
		const filledBuckets = mcpCalls.reduce((acc, call) => {
			const callTime = new Date(call.timestamp).getTime()
			const bucketTime = Math.floor(callTime / bucketDuration) * bucketDuration
			const bucket = acc.get(bucketTime)
			if (bucket) {
				if (call.error) {
					bucket.error++
				} else if (call.response) {
					bucket.success++
				}
			}
			return acc
		}, buckets)

		// Convert to array format for charting
		const successData = Array.from(filledBuckets.entries()).map(([time, data]) => ({
			time: new Date(time).toLocaleTimeString([], {
				hour: "2-digit",
				minute: bucketSize === "minute" ? "2-digit" : undefined,
			}),
			value: data.success,
		}))

		const errorData = Array.from(filledBuckets.entries()).map(([time, data]) => ({
			time: new Date(time).toLocaleTimeString([], {
				hour: "2-digit",
				minute: bucketSize === "minute" ? "2-digit" : undefined,
			}),
			value: data.error,
		}))

		return { successData, errorData, bucketSize }
	}

	const { successData, errorData, bucketSize } = prepareActivityData()

	// Check if there are any errors
	const hasErrors = errorData.some((point) => point.value > 0)

	return (
		<div className="flex w-full flex-1 flex-col border-1 border-accent bg-accent/50 rounded-sm p-4">
			<div className="flex items-center justify-between border-b border-b-accent mb-2 pb-2">
				<span>Activity</span>
				<span className="text-xs text-foreground/50">per {bucketSize}</span>
			</div>
			{successData.length > 0 ? (
				<div className="flex-1 relative">
					<svg
						className="w-full h-32"
						viewBox="0 0 400 100"
						preserveAspectRatio="none"
						onMouseLeave={() => setTooltip(null)}
					>
						{/* Grid lines */}
						<defs>
							<pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
								<path
									d="M 0 0 L 0 20 M 0 20 L 40 20"
									fill="none"
									stroke="currentColor"
									strokeWidth="0.5"
									opacity="0.1"
								/>
							</pattern>
						</defs>
						<rect width="100%" height="100%" fill="url(#grid)" />

						{/* Success line */}
						<polyline
							fill="none"
							stroke="#4ade80"
							strokeWidth="2"
							points={successData
								.map((point, index) => {
									const x = (index / (successData.length - 1)) * 380 + 10
									const maxValue = Math.max(
										...successData.map((d) => d.value),
										...errorData.map((d) => d.value),
										1,
									)
									const y = 90 - (point.value / maxValue) * 70
									return `${x},${y}`
								})
								.join(" ")}
						/>

						{/* Error line - only show if there are errors */}
						{hasErrors && (
							<polyline
								fill="none"
								stroke="#f87171"
								strokeWidth="2"
								points={errorData
									.map((point, index) => {
										const x = (index / (errorData.length - 1)) * 380 + 10
										const maxValue = Math.max(
											...successData.map((d) => d.value),
											...errorData.map((d) => d.value),
											1,
										)
										const y = 90 - (point.value / maxValue) * 70
										return `${x},${y}`
									})
									.join(" ")}
							/>
						)}

						{/* Invisible hover areas */}
						{successData.map((point, index) => {
							const x = (index / (successData.length - 1)) * 380 + 10
							return (
								<rect
									key={`hover-${index}`}
									x={x - 15}
									y="0"
									width="30"
									height="100"
									fill="transparent"
									style={{ cursor: "pointer" }}
									onMouseEnter={(e) => {
										setTooltip({
											x: e.clientX,
											y: e.clientY,
											successValue: successData[index].value,
											errorValue: errorData[index].value,
											time: successData[index].time,
										})
									}}
									onMouseMove={(e) => {
										if (tooltip) {
											setTooltip({
												x: e.clientX,
												y: e.clientY,
												successValue: successData[index].value,
												errorValue: errorData[index].value,
												time: successData[index].time,
											})
										}
									}}
								/>
							)
						})}

						{/* Success dots */}
						{successData.map((point, index) => {
							const x = (index / (successData.length - 1)) * 380 + 10
							const maxValue = Math.max(
								...successData.map((d) => d.value),
								...errorData.map((d) => d.value),
								1,
							)
							const y = 90 - (point.value / maxValue) * 70
							return (
								<circle
									key={`success-${index}`}
									cx={x}
									cy={y}
									r="3"
									fill="#4ade80"
									style={{ pointerEvents: "none" }}
								/>
							)
						})}

						{/* Error dots - only show if there are errors */}
						{hasErrors &&
							errorData.map((point, index) => {
								if (point.value === 0) return null
								const x = (index / (errorData.length - 1)) * 380 + 10
								const maxValue = Math.max(
									...successData.map((d) => d.value),
									...errorData.map((d) => d.value),
									1,
								)
								const y = 90 - (point.value / maxValue) * 70
								return (
									<circle
										key={`error-${index}`}
										cx={x}
										cy={y}
										r="3"
										fill="#f87171"
										style={{ pointerEvents: "none" }}
									/>
								)
							})}
					</svg>

					{/* Tooltip */}
					{tooltip && (
						<div
							className="fixed z-50 bg-background border border-accent rounded-md p-2 text-xs shadow-lg"
							style={{
								left: tooltip.x,
								top: tooltip.y - 80,
								transform: "translateX(-50%)",
							}}
						>
							<div className="font-medium text-foreground/90 mb-1">{tooltip.time}</div>
							<div className="flex items-center gap-2">
								<div className="flex items-center gap-1">
									<div className="w-2 h-2 rounded-full bg-green-400"></div>
									<span className="text-foreground/70">Success: {tooltip.successValue}</span>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<div className="flex items-center gap-1">
									<div className="w-2 h-2 rounded-full bg-red-400"></div>
									<span className="text-foreground/70">Error: {tooltip.errorValue}</span>
								</div>
							</div>
						</div>
					)}

					{/* Legend */}
					<div className="flex items-center gap-4 mt-2 text-xs">
						<div className="flex items-center gap-1">
							<div className="w-2 h-2 rounded-full bg-green-400"></div>
							<span className="text-foreground/70">Success</span>
						</div>
						{hasErrors && (
							<div className="flex items-center gap-1">
								<div className="w-2 h-2 rounded-full bg-red-400"></div>
								<span className="text-foreground/70">Error</span>
							</div>
						)}
					</div>
				</div>
			) : (
				<div className="flex-1 flex items-center justify-center text-sm text-foreground/50">
					No activity data available
				</div>
			)}
		</div>
	)
}
