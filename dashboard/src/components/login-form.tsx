"use client"
import { authClient } from "@/app/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { config } from "@/lib/config"
import { GithubIcon } from "lucide-react"
import Image from "next/image"
import { useState, useEffect, type FormEvent } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function LoginForm({
	className,
	redirectTo,
	...props
}: { className?: string; redirectTo?: string }) {
	const [email, setEmail] = useState("")
	const [loading, setLoading] = useState(false)
	const router = useRouter()

	useEffect(() => {
		const autoSignInLocal = async () => {
			if (config.isLocal) {
				console.log("Local mode detected, attempting auto-login...")
				try {
					setLoading(true)
					await authClient.signIn.anonymous()

					// Redirect to the intended destination or home
					const redirectUrl = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/"
					router.push(redirectUrl)
				} catch (error) {
					toast.error("Auto-login failed", {
						description: error instanceof Error ? error.message : "Unknown error occurred",
					})
					setLoading(false)
				}
			}
		}

		autoSignInLocal()
	}, [redirectTo, router])
	const emailLogin = async () => {
		setLoading(true)
		const { data, error } = await authClient.signIn.magicLink({
			email,
			callbackURL: redirectTo && redirectTo.startsWith("/") ? redirectTo : "/",
		})
		setLoading(false)
	}

	const signInGithub = async () => {
		setLoading(true)
		const data = await authClient.signIn
			.social({
				provider: "github",
				callbackURL: redirectTo && redirectTo.startsWith("/") ? redirectTo : "/",
			})
			.catch(() => {
				setLoading(false)
			})
	}

	if (loading && config.isLocal) {
		return (
			<div className={cn("flex flex-col gap-6 font-mono", className)} {...props}>
				<Card className="w-full border-accent">
					<CardHeader>
						<Image
							src={"/logo.png"}
							alt="Logo"
							width={100}
							height={100}
							className="w-20 h-20 mx-auto mb-4 border-3 border-accent shadow-md rounded-sm"
						/>
						<CardTitle className="text-2xl uppercase">Auto-signing in...</CardTitle>
						<CardDescription>Detected local development mode</CardDescription>
					</CardHeader>
				</Card>
			</div>
		)
	}

	return (
		<div className={cn("flex flex-col gap-6 font-mono", className)} {...props}>
			<Card className="w-full border-accent">
				<CardHeader>
					<Image
						src={"/logo.png"}
						alt="Logo"
						width={100}
						height={100}
						className="w-20 h-20 mx-auto mb-4 border-3 border-accent shadow-md rounded-sm"
					/>
					<CardTitle className="text-2xl uppercase">Sign in</CardTitle>
				</CardHeader>
				<CardContent className="border-t-1 border-accent">
					<div className="flex flex-col gap-6 mt-6">
						<Button
							onClick={() => signInGithub()}
							type="submit"
							className="w-full uppercase"
							disabled={loading}
						>
							<GithubIcon /> Login with Github
						</Button>
					</div>
				</CardContent>
				<div className="flex items-center justify-center gap-2">
					<div className="w-1/3 h-px bg-accent" />
					<span className="text-sm text-muted-foreground mx-3">or</span>
					<div className="w-1/3 h-px bg-accent" />
				</div>
				<CardContent className="">
					<div className="flex flex-col gap-6">
						<div className="grid gap-2">
							<CardDescription>Enter your email to login</CardDescription>
							<Label htmlFor="email">Email</Label>
							<Input
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								id="email"
								type="email"
								placeholder="me@example.com"
								required
							/>
						</div>
						<Button
							onClick={() => emailLogin()}
							type="submit"
							className="w-full uppercase"
							disabled={loading || email.length < 3}
						>
							Login
						</Button>
					</div>
				</CardContent>
			</Card>
			<div className="text-xs flex items-center gap-5 py-3 justify-center underline underline-offset-3 decoration-dotted decoration-foreground/20">
				<a href="/terms" className="text-muted-foreground hover:text-foreground">
					Terms of Service
				</a>
				<a href="/privacy" className="text-muted-foreground hover:text-foreground">
					Privacy Policy
				</a>
			</div>
		</div>
	)
}
