import { InstanceLog } from "@/db/schema"

export interface McpCall {
	id?: number
	jsonrpc: string
	method?: string
	params?: any
	result?: any
	error?: any
	timestamp?: string
	logLevel?: string
	logType?: string
}

export interface McpCallGroup {
	id: string | number
	request?: McpCall
	response?: McpCall
	error?: McpCall
	timestamp: string
	method?: string
}

export function parseMcpCalls(logs: InstanceLog[]): McpCallGroup[] {
	// Filter to only mcp_stdout and mcp_stdin logs
	const mcpLogs = logs.filter((log) => log.logType === "mcp_stdout" || log.logType === "mcp_stdin")

	const calls: McpCall[] = mcpLogs.reduce((acc: McpCall[], item) => {
		try {
			const parsed = JSON.parse(item.message)

			acc.push({
				...parsed,
				timestamp: item.timestamp,
				logLevel: item.level,
				logType: item.logType,
			})
		} catch (e) {
			console.log(e)
		}
		return acc
	}, [])

	// Sort by timestamp
	calls.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())

	// Group calls by ID
	const groupedCalls = new Map<string | number, McpCallGroup>()

	for (const call of calls) {
		if (call.id !== undefined) {
			const id = call.id
			if (!groupedCalls.has(id)) {
				groupedCalls.set(id, {
					id,
					timestamp: call.timestamp || new Date().toISOString(),
				})
			}

			const group = groupedCalls.get(id)!

			if (call.method) {
				// This is a request
				group.request = call
				group.method = call.method
				// Use request timestamp as the primary timestamp
				group.timestamp = call.timestamp || new Date().toISOString()
			} else if (call.result !== undefined) {
				// This is a response
				group.response = call
			} else if (call.error !== undefined) {
				// This is an error response
				group.error = call
			}
		} else if (call.method) {
			// This is a notification (no id)
			// Create a unique group for each notification using timestamp + method
			const notificationId = `notification_${call.method}_${call.timestamp}`
			groupedCalls.set(notificationId, {
				id: notificationId,
				request: call,
				method: call.method,
				timestamp: call.timestamp || new Date().toISOString(),
			})
		}
	}

	// Convert to array and sort by timestamp
	const result = Array.from(groupedCalls.values())
	result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

	return result
}

export function getCallPairs(calls: McpCall[]): Array<{ request: McpCall; response?: McpCall }> {
	const pairs: Array<{ request: McpCall; response?: McpCall }> = []
	const requestMap = new Map<number, McpCall>()

	for (const call of calls) {
		if (call.method && call.id !== undefined) {
			// This is a request
			requestMap.set(call.id, call)
			pairs.push({ request: call })
		} else if (call.id !== undefined && (call.result !== undefined || call.error !== undefined)) {
			// This is a response
			const pairIndex = pairs.findIndex((pair) => pair.request.id === call.id && !pair.response)
			if (pairIndex !== -1) {
				pairs[pairIndex].response = call
			} else {
				// Orphaned response, add as standalone
				pairs.push({ request: call })
			}
		} else {
			// Notification or other message
			pairs.push({ request: call })
		}
	}

	return pairs
}
