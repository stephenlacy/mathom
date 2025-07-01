"use client"

import { cn } from "@/lib/utils"
import {
	BotIcon,
	ChevronDownIcon,
	LayoutGridIcon,
	MoonIcon,
	SquarePlayIcon,
	SunIcon,
} from "lucide-react"

import {
	BellIcon,
	CreditCardIcon,
	LogOutIcon,
	MoreVerticalIcon,
	UserCircleIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "./ui/theme-toggle"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "@/components/ui/sidebar"

import Link from "next/link"

import { usePathname } from "next/navigation"
import { signOut, useSession } from "@/app/auth-client"
import { useTheme } from "next-themes"
import { Button } from "./ui/button"

const links = [
	{
		name: "Dashboard",
		href: "/",
		icon: LayoutGridIcon,
	},
	// {
	// 	name: "Instances",
	// 	href: "/instances",
	// 	icon: BotIcon, // SquarePlayIcon,
	// },
	// {
	// 	name: "Sessions",
	// 	href: "/sessions",
	// 	icon: SquarePlayIcon, // ChartNoAxesCombinedIcon,
	// },
]

export function Sidebar() {
	const pathname = usePathname()
	return (
		<SidebarProvider className="flex flex-col h-full w-[256px] border-r-1 border-r-accent bg-accent/20 fixed">
			<div className="flex p-5 justify-between items-center uppercase">
				<div>default</div>
				<div>
					<ChevronDownIcon />
				</div>
			</div>

			{links.map((link) => {
				const Icon = link.icon
				const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`)
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

			<div className="flex p-2 mt-auto">
				<UserMenu />
			</div>
		</SidebarProvider>
	)
}

function UserMenu() {
	const { data: session, isPending } = useSession()
	const { setTheme } = useTheme()

	const logout = async () => {
		await signOut()
		window.location.reload()
	}

	if (isPending) {
		return null
	}

	if (!session) {
		return null
	}
	const user = session.user

	const initials = `${user.email.charAt(0)}${user.email.charAt(1)}`

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded-lg grayscale">
								<AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.name}</span>
								<span className="truncate text-xs text-muted-foreground">{user.email}</span>
							</div>
							<MoreVerticalIcon className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
						side={"right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{user.name}</span>
									<span className="truncate text-xs text-muted-foreground">{user.email}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<SunIcon className="h-[16px] w-[16px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
									<MoonIcon className="absolute h-[16px] w-[16px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
									<span className="ml-1">Theme</span>
								</DropdownMenuSubTrigger>
								<DropdownMenuPortal>
									<DropdownMenuSubContent>
										<DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
										<DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
										<DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
									</DropdownMenuSubContent>
								</DropdownMenuPortal>
							</DropdownMenuSub>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={logout}>
							<LogOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
