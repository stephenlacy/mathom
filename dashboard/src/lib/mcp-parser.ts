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

export function parseMcpCalls(logs: InstanceLog[]): McpCall[] {
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
	return calls.sort(
		(a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime(),
	)
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
