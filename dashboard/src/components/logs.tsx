import { MoreScrollContainer } from "./ui/more-scroll-container"

interface LogsProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string
	logs: string[]
}

export function Logs({ logs = [], className }: LogsProps) {
	const logsContent = logs.join("\n")

	return (
		<MoreScrollContainer
			className={className}
			containerClassName="min-h-full break-words pt-1"
			header="Logs"
		>
			{logsContent ? (
				<pre className="whitespace-pre-wrap text-foreground/80 font-mono mt-2">
					{logsContent}
				</pre>
			) : (
				<div className="text-foreground/50 text-sm text-center justify-center items-center flex h-[90%] flex-1">
					No logs available
				</div>
			)}
		</MoreScrollContainer>
	)
}
