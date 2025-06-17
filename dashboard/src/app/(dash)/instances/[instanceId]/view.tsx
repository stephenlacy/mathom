"use client"

import { Logs } from "@/components/logs"
import { McpCalls } from "@/components/mcp-calls"
import { McpTools } from "@/components/mcp-tools"
import { ActivityChart } from "@/components/activity-chart"
import { InstanceStatus } from "@/components/instance-status"
import { Instance } from "@/db/schema"
import { User } from "better-auth"
import { EmptyInstances } from "@/components/empty-instances"
import { useCmdLogs, useMcpLogs } from "@/hooks/use-instance-logs"
import { parseMcpCalls } from "@/lib/mcp-parser"

interface ProcessEvent {
	event: string
	timestamp: string
	signal_number?: number
	exit_code?: number
	action?: string
	[key: string]: any
}

export function InstanceView({
	user,
	instance,
}: {
	user: User
	instance: Instance
}) {
	const { data: cmdLogs, isLoading: cmdLoading, isError: cmdError } = useCmdLogs(instance.id!)

	const { data: mcpLogs, isLoading: mcpLoading, isError: mcpError } = useMcpLogs(instance.id!)

	const mcpCalls = parseMcpCalls(mcpLogs || [])

	const logs = cmdLogs?.map((log) => log.message) || []

	// Extract process events from logs
	const processEvents =
		cmdLogs?.reduce((acc, log) => {
			try {
				const parsedMessage = JSON.parse(log.message)
				if (parsedMessage?.event) {
					acc.push({
						event: parsedMessage.event,
						timestamp: log.timestamp,
						signal_number: parsedMessage.signal_number,
						exit_code: parsedMessage.exit_code,
						action: parsedMessage.action,
						...parsedMessage,
					})
				}
			} catch {
				// Skip invalid JSON
			}
			return acc
		}, [] as ProcessEvent[]) || []

	return (
		<div className="flex flex-col p-4 w-full">
			<div className="flex gap-4">
				<div className="flex w-full flex-1 flex-col border-1 border-accent bg-accent/50 rounded-sm p-4">
					<div className="flex items-center justify-between border-b border-b-accent mb-2 pb-2">
						Info
					</div>

					<div className="flex items-center justify-between">
						<div className="">Name</div>
						<div className="text-sm text-foreground/50">{instance.name}</div>
					</div>
					<div className="flex items-center justify-between">
						<div className="">Image</div>
						<div className="text-sm text-foreground/50">{instance.runtime}</div>
					</div>
					<div className="flex items-center justify-between">
						<div className="">Command</div>
						<div className="text-sm text-foreground/50">{instance.cmd}</div>
					</div>
					<div className="flex items-center justify-between">
						<div className="">Arguments</div>
						<div className="text-sm text-foreground/50">{JSON.stringify(instance.args || [])}</div>
					</div>
				</div>

				<div className="flex w-full flex-1 flex-col border-1 border-accent bg-accent/50 rounded-sm p-4">
					<div className="flex items-center justify-between border-b border-b-accent mb-2 pb-2">
						<span>Status</span>
						<InstanceStatus 
							status={instance.status} 
							exitCode={instance.exitCode}
							className="text-sm"
						/>
					</div>
					{processEvents.length > 0 && (
						<div className="space-y-1">
							{processEvents.map((event, index) => (
								<div key={index} className="relative flex items-center justify-between text-xs">
									<div className="flex items-center gap-2">
										<div
											className={`w-2 h-2 rounded-full ${
												event.event === "process_start"
													? "bg-green-400"
													: event.event === "process_exit"
														? event.signal_number === 0 || event.exit_code === 0
															? "bg-gray-400"
															: "bg-red-400"
														: event.event === "signal_received"
															? "bg-orange-400"
															: "bg-gray-400"
											}`}
										/>
										<span className="text-foreground/70">
											{event.event}
											{event.event === "process_exit" &&
												(event.signal_number !== undefined || event.exit_code !== undefined) && (
													<span className="ml-1 text-xs opacity-75">
														({event.signal_number ?? event.exit_code})
													</span>
												)}
										</span>
									</div>
									<div className="text-foreground/50">
										{new Date(event.timestamp).toLocaleTimeString()}
									</div>
									{index < processEvents.length - 1 ? (
										<div className="absolute left-[4px] bottom-[-4px] w-[1px] h-[4px] bg-border"></div>
									) : null}
								</div>
							))}
						</div>
					)}
				</div>
				<ActivityChart mcpCalls={mcpCalls} />
			</div>
			<div className="flex gap-4 mt-4">
				<div className="flex-1">
					{mcpLoading ? (
						<div className="relative flex flex-col border-1 bg-accent/50 h-[600px] max-h-[900px] w-full rounded-sm inset-shadow-md inset-shadow-accent">
							<div className="p-4 border-b border-accent">History</div>
							<div className="flex items-center justify-center h-full">
								<div className="text-foreground/50 text-sm">Loading MCP calls...</div>
							</div>
						</div>
					) : mcpError ? (
						<div className="relative flex flex-col border-1 bg-accent/50 h-[600px] max-h-[900px] w-full rounded-sm inset-shadow-md inset-shadow-accent">
							<div className="p-4 border-b border-accent">History</div>
							<div className="flex items-center justify-center h-full">
								<div className="text-red-500 text-sm">Error loading MCP calls</div>
							</div>
						</div>
					) : (
						<McpCalls calls={mcpCalls} className="flex-1" />
					)}
				</div>
				<EmptyInstances first={false} instance={instance} className="flex-1" />
			</div>
			<div className="grid grid-cols-2 gap-4 mt-4">
				<div className="flex-1">
					{mcpLoading ? (
						<div className="relative flex flex-col border-1 bg-accent/50 h-[600px] max-h-[900px] w-full rounded-sm inset-shadow-md inset-shadow-accent">
							<div className="p-4 border-b border-accent">Tools</div>
							<div className="flex items-center justify-center h-full">
								<div className="text-foreground/50 text-sm">Loading tools...</div>
							</div>
						</div>
					) : mcpError ? (
						<div className="relative flex flex-col border-1 bg-accent/50 h-[600px] max-h-[900px] w-full rounded-sm inset-shadow-md inset-shadow-accent">
							<div className="p-4 border-b border-accent">Tools</div>
							<div className="flex items-center justify-center h-full">
								<div className="text-red-500 text-sm">Error loading tools</div>
							</div>
						</div>
					) : (
						<McpTools mcpCalls={mcpCalls} className="flex-1" />
					)}
				</div>
				<div className="flex-1">
					{cmdLoading ? (
						<div className="relative flex flex-col border-1 bg-accent/50 h-[600px] max-h-[900px] w-full rounded-sm inset-shadow-md inset-shadow-accent">
							<div className="p-4 border-b border-accent">Logs</div>
							<div className="flex items-center justify-center h-full">
								<div className="text-foreground/50 text-sm">Loading logs...</div>
							</div>
						</div>
					) : cmdError ? (
						<div className="relative flex flex-col border-1 bg-accent/50 h-[600px] max-h-[900px] w-full rounded-sm inset-shadow-md inset-shadow-accent">
							<div className="p-4 border-b border-accent">Logs</div>
							<div className="flex items-center justify-center h-full">
								<div className="text-red-500 text-sm">Error loading logs</div>
							</div>
						</div>
					) : (
						<Logs logs={logs} className="" />
					)}
				</div>
			</div>
		</div>
	)
}
