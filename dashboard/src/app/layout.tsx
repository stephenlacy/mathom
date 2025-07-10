import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { AutoLogin } from "@/components/auto-login"

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
})

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
})

export const metadata: Metadata = {
	title: "RECALL",
	description: "",
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<link rel="icon" href="/favicon.png" sizes="any" />
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-[100vh]`}
				suppressHydrationWarning
			>
				<ThemeProvider defaultTheme="system" attribute="class" enableSystem storageKey="m-theme">
					<QueryProvider>
						<AutoLogin />
						{children}
					</QueryProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
