import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "./ui/button"
import { LucideArrowDown, LucideChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogsProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string
	logs: string[]
}

export function Logs({ logs = [], className }: LogsProps) {
	const logsContainerRef = useRef<HTMLDivElement>(null)
	const logsRef = useRef<HTMLPreElement>(null)
	const [more, showMore] = useState(false)

	const logsContent = logs.join("\n")

	const handleScroll = useCallback((e: Event) => {
		const target = e.currentTarget as HTMLDivElement
		if (target.scrollTop <= target.scrollHeight - target.offsetHeight && !more) {
			showMore(true)
		}
		if (target.scrollTop >= target.scrollHeight - target.offsetHeight) {
			showMore(false)
		}
	}, [])

	useEffect(() => {
		logsContainerRef.current?.addEventListener("scroll", handleScroll)
	}, [handleScroll])

	useEffect(() => {
		if ((logsContainerRef.current?.scrollHeight || 0) >= 600 && !more) {
			showMore(true)
		}
	}, [logsContent])

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
							logsContainerRef.current?.scrollTo({
								top: logsContainerRef.current.scrollHeight,
								behavior: "smooth",
							})
						}}
					>
						More <LucideArrowDown className="ml-1 h-4 w-4" />
					</Button>
				</div>
			) : null}
			<div className="p-4 border-b border-accent">Logs</div>
			<div ref={logsContainerRef} className="overflow-scroll min-h-full break-words p-4 pt-1">
				{logsContent ? (
					<pre ref={logsRef} className="whitespace-pre-wrap text-foreground/80 font-mono mt-2">
						{logsContent}
					</pre>
				) : (
					<div className="text-foreground/50 text-sm text-center justify-center items-center flex h-[90%] flex-1">
						No logs available
					</div>
				)}
			</div>
		</div>
	)
}
