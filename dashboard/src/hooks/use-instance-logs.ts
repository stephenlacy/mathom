import { useQuery } from "@tanstack/react-query"
import { InstanceLog } from "@/db/schema"

type LogType = "mcp_stdout" | "mcp_stderr" | "cmd_log" | "mcp_stdin" | "mcp"
type LogLevel = "info" | "error" | "debug" | "warn"

interface LogsQueryParams {
	logType?: LogType
	level?: LogLevel
	limit?: number
	offset?: number
}

async function fetchInstanceLogs(
	instanceId: string,
	params: LogsQueryParams = {},
): Promise<InstanceLog[]> {
	const searchParams = new URLSearchParams()

	if (params.logType) searchParams.set("logType", params.logType)
	if (params.level) searchParams.set("level", params.level)
	if (params.limit) searchParams.set("limit", params.limit.toString())
	if (params.offset) searchParams.set("offset", params.offset.toString())

	const response = await fetch(`/api/v1/instances/${instanceId}/logs?${searchParams}`)

	if (!response.ok) {
		throw new Error(`Failed to fetch logs: ${response.statusText}`)
	}

	return response.json()
}

export function useInstanceLogs(instanceId: string, params: LogsQueryParams = {}) {
	return useQuery({
		queryKey: ["instance-logs", instanceId, params],
		queryFn: () => fetchInstanceLogs(instanceId, params),
		enabled: !!instanceId,
		refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
	})
}

export function useCmdLogs(instanceId: string) {
	return useInstanceLogs(instanceId, { logType: "cmd_log", limit: 500 })
}

export function useMcpLogs(instanceId: string) {
	return useInstanceLogs(instanceId, { logType: "mcp", limit: 500 })
}
