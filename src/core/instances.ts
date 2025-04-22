import { db } from "@/db/drizzle"
import { instances } from "@/db/schema"
import { eq } from "drizzle-orm"

export const listInstances = async (userId: string) => {
	const res = await db.select().from(instances).where(eq(instances.userId, userId)).execute()

	return res
}
