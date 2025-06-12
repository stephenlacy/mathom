"use client"

import { Logs } from "@/components/logs"
import { InstanceFull } from "@/db/schema"
import { User } from "better-auth"
import { EmptyInstances } from "@/components/empty-instances"

export function InstanceView({
	user,
	instance,
}: {
	user: User
	instance: InstanceFull
}) {
	const logs = instance.logs?.map((log) => log.message) || []
	return (
		<div className="flex flex-col p-4 w-full">
			<div className="flex gap-4">
				<div className="flex w-full flex-1 flex-col border-1 border-accent bg-accent/50 rounded-sm p-4">
					<div className="flex items-center justify-between border-b border-b-accent mb-2 pb-2">
						Info
					</div>

					<div className="flex items-center justify-between">
						<div className="">Name</div>
						<div className="text-sm text-foreground/50">{instance.name}</div>
					</div>
					<div className="flex items-center justify-between">
						<div className="">Image</div>
						<div className="text-sm text-foreground/50">{instance.runtime}</div>
					</div>
					<div className="flex items-center justify-between">
						<div className="">Command</div>
						<div className="text-sm text-foreground/50">{instance.cmd}</div>
					</div>
					<div className="flex items-center justify-between">
						<div className="">Arguments</div>
						<div className="text-sm text-foreground/50">{JSON.stringify(instance.args || [])}</div>
					</div>
				</div>

				<div className="flex w-full flex-1 flex-col border-1 border-accent bg-accent/50 rounded-sm p-4">
					<div className="flex items-center justify-between border-b border-b-accent mb-2 pb-2">
						Status
					</div>
				</div>
				<div className="flex w-full flex-1 flex-col border-1 border-accent bg-accent/50 rounded-sm p-4">
					<div className="flex items-center justify-between border-b border-b-accent mb-2 pb-2">
						Activity
					</div>
				</div>
			</div>
			<div className="flex gap-4 mt-4">
				<Logs logs={logs} className="flex-1" />
				<EmptyInstances className="flex-1" first={false} instance={instance} />
			</div>
		</div>
	)
}
