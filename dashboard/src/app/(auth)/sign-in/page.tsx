import { LoginForm } from "@/components/login-form"

export default async function SignIn({
	searchParams,
}: {
	searchParams: Promise<{ redirectTo?: string }>
}) {
	const params = await searchParams
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<LoginForm redirectTo={params.redirectTo} />
			</div>
		</div>
	)
}
