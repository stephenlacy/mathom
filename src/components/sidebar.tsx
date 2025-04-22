"use client"

import { cn } from "@/lib/utils"
import {
	BotIcon,
	ChartNoAxesCombined,
	ChartNoAxesCombinedIcon,
	ChevronDownIcon,
	LayoutGridIcon,
	PlayIcon,
	SquarePlayIcon,
} from "lucide-react"
import Link from "next/link"

import { usePathname } from "next/navigation"

const links = [
	{
		name: "Dashboard",
		href: "/",
		icon: LayoutGridIcon,
	},
	{
		name: "Instances",
		href: "/instances",
		icon: BotIcon, // SquarePlayIcon,
	},
	{
		name: "Sessions",
		href: "/sessions",
		icon: SquarePlayIcon, // ChartNoAxesCombinedIcon,
	},
]

export function Sidebar() {
	const pathname = usePathname()
	return (
		<div className="flex flex-col w-[256px] border-1 bg-accent/20">
			<div className="flex p-5 justify-between items-center uppercase">
				<div>default</div>
				<div>
					<ChevronDownIcon />
				</div>
			</div>

			{links.map((link) => {
				const Icon = link.icon
				const isActive = pathname === link.href
				return (
					<Link
						href={link.href}
						key={link.name}
						className={cn(
							"flex items-center px-4 py-2 gap-3 text-foreground/50 hover:bg-accent/40 hover:text-foreground transition-colors",
							isActive && "text-foreground border-r-1 border-r-foreground",
						)}
					>
						<div className="text-foreground-muted">
							<Icon className="w-4 h-4" />
						</div>
						<div className="uppercase">{link.name}</div>
					</Link>
				)
			})}

			<div className="flex p-3 mt-auto">footer</div>
		</div>
	)
}
