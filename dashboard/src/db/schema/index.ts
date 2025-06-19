import { InstanceLog } from "./instance-logs"
import { instances } from "./instances"

export * from "./auth"
export * from "./instances"
export * from "./instance-logs"
export * from "./oauth"
export * from "./cli-verifications"

export type Instance = typeof instances.$inferSelect

export type InstanceFull = typeof instances.$inferSelect & {
	logs: InstanceLog[]
}

export type InstanceWithOptionalLogs = typeof instances.$inferSelect & {
	logs?: InstanceLog[]
}
