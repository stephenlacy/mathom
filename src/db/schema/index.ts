import { InstanceLog } from "./instance-logs"
import { instances } from "./instances"

export * from "./auth"
export * from "./instances"
export * from "./instance-logs"
export * from "./oauth"

export type InstanceFull = typeof instances.$inferInsert & {
	logs: InstanceLog[]
}
