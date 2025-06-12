"use client"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface Route {
	id: string
	label: string
}

interface TopbarProps {
	routes?: Route[]
}

interface BreadcrumbItem {
	label: string
	href: string
}

export function Topbar({ routes = [] }: TopbarProps) {
	const pathname = usePathname()

	const generateBreadcrumbs = (): BreadcrumbItem[] => {
		const segments = pathname.split("/").filter(Boolean)

		if (segments.length === 0) {
			return [{ label: "/", href: "/" }]
		}

		return segments.reduce<BreadcrumbItem[]>(
			(acc, segment) => {
				const currentPath =
					acc.length === 1 ? `/${segment}` : `${acc[acc.length - 1].href}/${segment}`

				const route = routes.find((r) => r.id === segment)
				const label = route ? route.label : segment

				acc.push({
					label,
					href: currentPath,
				})

				return acc
			},
			[{ label: "/", href: "/" }],
		)
	}

	const breadcrumbs = generateBreadcrumbs()

	const lastIndex = breadcrumbs.length - 1

	return (
		<div className="flex h-[64px] flex-row items-center justify-between w-full px-4 border-b-1 border-b-accent bg-accent/20">
			<nav className="flex flex-row items-center" aria-label="Breadcrumb">
				<ol className="flex items-center">
					{breadcrumbs.map((breadcrumb, index) => (
						<li key={breadcrumb.href} className="flex items-center">
							{index > 0 && <ChevronRight className="h-4 w-4 text-foreground/50 mx-1" />}
							{index === lastIndex ? (
								<span className="text-sm text-foreground font-medium">{breadcrumb.label}</span>
							) : (
								<Link
									href={breadcrumb.href}
									className="text-sm text-foreground/70 hover:text-foreground transition-colors"
								>
									{breadcrumb.label}
								</Link>
							)}
						</li>
					))}
				</ol>
			</nav>
		</div>
	)
}
