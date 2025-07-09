import { drizzle as neon } from "drizzle-orm/neon-http"
import { drizzle as pg } from "drizzle-orm/postgres-js"
import * as schema from "./schema"

type DatabaseType = ReturnType<typeof neon<typeof schema>> | ReturnType<typeof pg<typeof schema>>

export const db: DatabaseType =
	process.env.MODE === "local"
		? pg({ connection: process.env.DATABASE_URL!, schema })
		: neon(process.env.DATABASE_URL!, { schema })
