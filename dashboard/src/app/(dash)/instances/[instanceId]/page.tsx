import { Topbar } from "@/components/topbar"
import { getInstance } from "@/core/instances"
import { getUser } from "@/lib/auth"
import { InstanceView } from "./view"
import { notFound } from "next/navigation"

export default async function InstancePage({
	params,
}: {
	params: Promise<{ instanceId: string }>
}) {
	const p = await params

	const user = await getUser()

	const instance = await getInstance(user.id, p.instanceId).catch((err) => {
		if (err.message === "Instance not found") {
			return null
		}
		throw err
	})

	if (!instance) {
		return notFound()
	}

	return (
		<div>
			<Topbar routes={[{ id: instance.id, label: instance.name }]} />
			<InstanceView user={user} instance={instance} />
		</div>
	)
}
