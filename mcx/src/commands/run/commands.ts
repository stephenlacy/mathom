import { buildCommand } from "@stricli/core"
import { config } from "../../config"
import { api } from "../../api"
import { server } from "../../server"

type Flags = {
	yes?: boolean
}

export const runCommand = buildCommand({
	func: async (flags: Flags, cmd: string, ...args: string[]) => {
		const cfg = config.get()
		if (!cmd) {
			console.error("No command provided")
			process.exit(1)
		}
		if (!cfg.accessToken) {
			console.error("Please authenticate with: mcx auth login")
			process.exit(1)
		}

		// ignore flags.yes as this runs from a MCP client

		try {
			const res = await api(cfg).run({ name: cmd, args: ["-y", ...args] })

			const proxy = await server(cfg, res)
		} catch (error: unknown) {
			if (error instanceof Error && error.message.includes("401 Unauthorized")) {
				console.error("Unauthorized: Please authenticate with: mcx auth login")
				process.exit(1)
			}
			console.error("Error running command:", error)
			process.exit(1)
		}
	},
	docs: {
		brief: "Run a MCP server",
	},
	parameters: {
		flags: {
			yes: {
				brief: "Accept",
				kind: "boolean",
				optional: true,
			},
		},
		positional: {
			kind: "array",
			parameter: {
				brief: "Server commands to run",
				parse: String,
				optional: false,
			},
		},
		aliases: {
			// @ts-ignore
			y: "yes",
		},
	},
})
