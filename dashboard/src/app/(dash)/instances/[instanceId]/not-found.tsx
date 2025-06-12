import { Topbar } from "@/components/topbar"
import Link from "next/link"

export default function NotFound() {
	return (
		<div>
			<Topbar routes={[]} />
			<div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
				<div className="flex flex-col items-center space-y-6 text-center">
					<div className="text-8xl font-bold text-foreground/20">404</div>
					<div className="space-y-2">
						<h1 className="text-2xl font-semibold">Instance Not Found</h1>
						<p className="text-foreground/60 max-w-md">
							The instance you're looking for doesn't exist or has been removed.
						</p>
					</div>
					<div className="flex gap-4">
						<Link
							href="/instances"
							className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
						>
							View All Instances
						</Link>
						<Link
							href="/"
							className="inline-flex items-center justify-center px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
						>
							Go Home
						</Link>
					</div>
				</div>
			</div>
		</div>
	)
}

