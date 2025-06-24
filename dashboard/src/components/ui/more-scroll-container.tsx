"use client"

import { useCallback, useEffect, useRef, useState, ReactNode } from "react"
import { Button } from "./button"
import { LucideArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface MoreScrollContainerProps {
	children: ReactNode
	className?: string
	containerClassName?: string
	header?: ReactNode
	footer?: ReactNode
}

export function MoreScrollContainer({
	children,
	className,
	containerClassName,
	header,
	footer,
}: MoreScrollContainerProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [more, showMore] = useState(false)

	const checkScrollPosition = useCallback(() => {
		const container = containerRef.current
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
		const container = containerRef.current
		if (container) {
			container.addEventListener("scroll", handleScroll)
			return () => container.removeEventListener("scroll", handleScroll)
		}
	}, [handleScroll])

	useEffect(() => {
		// Check scroll position when content changes
		const timeoutId = setTimeout(checkScrollPosition, 100)
		return () => clearTimeout(timeoutId)
	}, [children, checkScrollPosition])

	return (
		<div
			className={cn(
				"relative flex flex-col border-1 border-accent bg-accent/50 h-[650px] max-h-[900px] w-full rounded-sm inset-shadow-md inset-shadow-accent",
				className,
			)}
		>
			{more && (
				<div className="flex absolute z-10 text-sm text-foreground/50 mt-2 bottom-4 left-0 right-0 items-center justify-center">
					<Button
						variant="secondary"
						className="h-7 rounded-2xl shadow-2xl border-foreground/20 border text-foreground/80"
						onClick={() => {
							containerRef.current?.scrollTo({
								top: containerRef.current.scrollHeight,
								behavior: "smooth",
							})
						}}
					>
						More <LucideArrowDown className="ml-1 h-4 w-4" />
					</Button>
				</div>
			)}

			{header && <div className="p-4 border-b border-accent">{header}</div>}

			<div
				ref={containerRef}
				className={cn("overflow-scroll h-full w-full p-4", containerClassName)}
			>
				{children}
			</div>

			{footer && <div className="p-4 border-t border-accent bg-accent/30">{footer}</div>}
		</div>
	)
}
