import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env" })
console.log(process.env)

export default defineConfig({
	schema: "./src/db/schema/index.ts",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
})
