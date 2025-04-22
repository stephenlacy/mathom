"use client"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "./ui/theme-toggle"
import Link from "next/link"

export function Topbar() {
	const paths = usePathname()
	const pathNames = paths.split("/").filter((path) => path)
	if (pathNames.length === 0) {
		pathNames.push("~")
	}

	return (
		<div className="flex h-[64px] flex-row items-center justify-between w-full px-4 border-b-1 border-b-accent-foreground-muted bg-accent/20">
			<div className="flex flex-row items-center">
				{pathNames.map((p: string) => {
					const href = p === "~" ? "/" : p
					return (
						<Link href={href} key={p} className="text-sm text-foreground uppercase ml-1">
							/ {p}
						</Link>
					)
				})}
			</div>
			<ThemeToggle />
		</div>
	)
}
