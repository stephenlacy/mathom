interface InstanceStatusProps {
	status: string
	exitCode?: string | null
	className?: string
}

export function InstanceStatus({ status, exitCode, className = "" }: InstanceStatusProps) {
	const getStatusColor = () => {
		switch (status) {
			case "running":
				return "bg-green-500/20 text-green-400"
			case "exited":
				return exitCode === "0" ? "bg-gray-500/20 text-gray-400" : "bg-red-500/20 text-red-400"
			case "pending":
				return "bg-yellow-500/20 text-yellow-400"
			default:
				return "bg-gray-500/20 text-gray-400"
		}
	}

	return (
		<span className={`text-xs px-2 py-1 rounded ${getStatusColor()} ${className}`}>
			{status}
			{status === "exited" && exitCode && <span className="ml-1 opacity-75">({exitCode})</span>}
		</span>
	)
}
