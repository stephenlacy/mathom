import { Badge } from "@/components/badge"
import { Tag } from "@/components/tag"
import { listInstances } from "@/core/instances"
import { getUser } from "@/lib/auth"
import { timeago } from "@/lib/timeago"
import { CheckIcon, ExternalLinkIcon } from "lucide-react"
import Link from "next/link"
import { EmptyInstances } from "@/components/empty-instances"

export default async function InstancesPage() {
	const user = await getUser()

	const instances = await listInstances(user.id)
	console.log({ instances })

	return (
		<div className="flex flex-col p-4">
			<div className="flex flex-col flex-1 items-center justify-center">
				{instances.map((instance) => {
					return (
						<Link
							key={instance.id}
							href={`/instances/${instance.id}`}
							className="flex flex-1 w-full gap-2 p-2 px-3 border-1 bg-accent/50 hover:bg-accent/80 border-accent first:rounded-t-sm last:rounded-b-sm"
						>
							<div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/80">
								<Badge variant="success">
									<CheckIcon className="h-4" />
								</Badge>
							</div>
							<div className="flex flex-col w-[400px]">
								<div className="text-md w-full truncate overflow-ellipsis">{instance.name}</div>
								<div className="text-sm text-foreground/50 hover:text-foreground/80">
									{instance.id}
								</div>
							</div>
							<div className="flex flex-col">
								<Tag>image: {instance.runtime}</Tag>
								<p className="text-foreground">Status: {instance.status}</p>
							</div>
							<div className="flex flex-col ml-auto items-center justify-center gap-1">
								<div
									className="flex text-sm text-foreground/50"
									title={instance.createdAt.toLocaleString()}
								>
									{timeago(instance.createdAt)}
								</div>
							</div>
						</Link>
					)
				})}
			</div>
			<div className="flex flex-col flex-1 items-center justify-center mt-8">
				<EmptyInstances first={instances.length === 0} />
			</div>
		</div>
	)
}
