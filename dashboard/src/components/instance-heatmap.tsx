"use client"

import { useMcpLogs } from "@/hooks/use-instance-logs"
import { parseMcpCalls } from "@/lib/mcp-parser"
import { useState } from "react"

interface InstanceHeatmapProps {
	instanceId: string
}

interface TooltipData {
	x: number
	y: number
	hour: number
	count: number
}

export function InstanceHeatmap({ instanceId }: InstanceHeatmapProps) {
	const [tooltip, setTooltip] = useState<TooltipData | null>(null)
	const { data: mcpLogs } = useMcpLogs(instanceId)
	const mcpCalls = parseMcpCalls(mcpLogs || [])

	// Generate 24 hours worth of data (24 squares)
	const generateHourlyData = () => {
		const now = new Date()
		const data = []

		// Create 24 hour buckets (current hour going backwards)
		for (let i = 23; i >= 0; i--) {
			const hourStart = new Date(now)
			hourStart.setHours(now.getHours() - i, 0, 0, 0)
			const hourEnd = new Date(hourStart)
			hourEnd.setHours(hourStart.getHours() + 1)

			// Count calls in this hour
			const count = mcpCalls.filter((call) => {
				const callTime = new Date(call.timestamp)
				return callTime >= hourStart && callTime < hourEnd
			}).length

			data.push({ hour: hourStart.getHours(), count })
		}

		return data
	}
	/*
   *[
		{ hour: 0, count: 0 },
		{ hour: 1, count: 1 },
		{ hour: 2, count: 2 },
		{ hour: 3, count: 3 },
		{ hour: 4, count: 4 },
		{ hour: 5, count: 5 },
		{ hour: 6, count: 6 },
		{ hour: 7, count: 7 },
		{ hour: 8, count: 8 },
		{ hour: 9, count: 9 },
		{ hour: 10, count: 10 },
		{ hour: 11, count: 11 },
		{ hour: 12, count: 12 },
		{ hour: 13, count: 13 },
		{ hour: 14, count: 14 },
		{ hour: 15, count: 15 },
		{ hour: 16, count: 16 },
		{ hour: 17, count: 17 },
		{ hour: 18, count: 18 },
		{ hour: 19, count: 19 },
		{ hour: 20, count: 20 },
		{ hour: 21, count: 21 },
		{ hour: 22, count: 22 },
		{ hour: 23, count: 23 },
	]
   */

	const hourlyData = generateHourlyData()
	const totalCount = hourlyData.reduce((sum, d) => sum + d.count, 0)
	const maxCount = Math.max(...hourlyData.map((d) => d.count), 1)

	const getIntensity = (count: number) => {
		if (count === 0) return 0
		if (count === 1) return 0.1
		if (totalCount <= 1) return 0.1

		const logMax = Math.log(maxCount + 1)
		const logCount = Math.log(count + 1)
		return Math.min(0.2 + (logCount / logMax) * 0.8, 1.0)
	}

	// Get color based on intensity (0-1) with dark/light mode support
	const getColor = (intensity: number) => {
		if (intensity === 0) return "bg-foreground/10 dark:bg-accent"

		if (intensity <= 0.1) return "bg-teal-200 dark:bg-teal-900"
		if (intensity <= 0.2) return "bg-teal-300 dark:bg-teal-800"
		if (intensity <= 0.3) return "bg-teal-400 dark:bg-teal-700"
		if (intensity <= 0.4) return "bg-teal-500 dark:bg-teal-600"
		if (intensity <= 0.5) return "bg-teal-600 dark:bg-teal-500"
		if (intensity <= 0.6) return "bg-green-500 dark:bg-teal-400"
		if (intensity <= 0.7) return "bg-green-600 dark:bg-teal-300"
		if (intensity <= 0.8) return "bg-lime-500 dark:bg-lime-300"
		if (intensity <= 0.9) return "bg-lime-600 dark:bg-lime-200"
		return "bg-lime-700 dark:bg-lime-300"
	}

	return (
		<div className="w-full relative">
			<div className="grid grid-cols-24 gap-0.5 w-full">
				{hourlyData.map((data, index) => {
					const intensity = getIntensity(data.count)
					return (
						<div
							key={index}
							className={`w-1 h-3 rounded-sm ${getColor(intensity)} cursor-pointer`}
							onMouseEnter={(e) => {
								const rect = e.currentTarget.getBoundingClientRect()
								setTooltip({
									x: rect.left + rect.width / 2,
									y: rect.top,
									hour: data.hour,
									count: data.count,
								})
							}}
							onMouseMove={(e) => {
								if (tooltip) {
									const rect = e.currentTarget.getBoundingClientRect()
									setTooltip({
										x: rect.left + rect.width / 2,
										y: rect.top,
										hour: data.hour,
										count: data.count,
									})
								}
							}}
							onMouseLeave={() => setTooltip(null)}
						/>
					)
				})}
			</div>
			<div className="flex justify-between text-xs text-foreground/50 mt-1">
				<span>{hourlyData[0]?.hour || 0}h</span>
				<span>now</span>
			</div>

			{/* Tooltip */}
			{tooltip && (
				<div
					className="fixed z-50 bg-background border border-accent rounded-md p-2 text-xs shadow-lg"
					style={{
						left: tooltip.x,
						top: tooltip.y - 50,
						transform: "translateX(-50%)",
					}}
				>
					<div className="font-medium text-foreground/90 mb-1">{tooltip.hour}:00</div>
					<div className="flex items-center gap-1">
						<span className="text-foreground/70">{tooltip.count} requests</span>
					</div>
				</div>
			)}
		</div>
	)
}
