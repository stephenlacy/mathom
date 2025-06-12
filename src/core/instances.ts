import { db } from "@/db/drizzle"
import { instances, instanceLogs } from "@/db/schema"
import { and, eq, asc } from "drizzle-orm"

export const listInstances = async (userId: string) => {
	const res = await db.select().from(instances).where(eq(instances.userId, userId)).execute()

	return res
}

export const getInstance = async (userId: string, instanceId: string) => {
	const res = await db.query.instances.findFirst({
		where: and(eq(instances.userId, userId), eq(instances.id, instanceId)),
		with: {
			logs: {
				orderBy: asc(instanceLogs.timestamp),
			},
		},
	})

	if (!res) {
		throw new Error("Instance not found")
	}

	return res
}
