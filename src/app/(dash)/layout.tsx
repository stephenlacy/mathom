import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) {
		return redirect("/sign-in")
	}
	return (
		<main className="flex flex-1 flex-row font-[family-name:var(--font-geist-mono)]">
			<Sidebar />
			<div className="flex flex-col w-full">
				<div className="main">{children}</div>
			</div>
		</main>
	)
}
