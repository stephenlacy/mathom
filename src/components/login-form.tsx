"use client"
import { authClient } from "@/app/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useState, type FormEvent } from "react"

export function LoginForm({ className, ...props }: { className?: string }) {
	const [email, setEmail] = useState("")
	const [loading, setLoading] = useState(false)
	const login = async () => {
		setLoading(true)
		const { data, error } = await authClient.signIn.magicLink({
			email,
			callbackURL: "/", //redirect after successful login (optional)
		})
		setLoading(false)
	}

	return (
		<div className={cn("flex flex-col gap-6 font-mono", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle className="text-2xl uppercase">Sign in</CardTitle>
					<CardDescription>Enter your email to login</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-6">
						<div className="grid gap-2">
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
							onClick={() => login()}
							type="submit"
							className="w-full uppercase"
							disabled={loading}
						>
							Login
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
