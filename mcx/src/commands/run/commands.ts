import { buildCommand } from "@stricli/core"
import { config } from "../../config"
import { api } from "../../api"
import { server } from "../../server"

type Flags = {
	cmd?: string
	yes?: boolean
	docker?: boolean
	env?: string[]
}

export const runCommand = buildCommand({
	func: async (flags: Flags, name: string, ...args: string[]) => {
		const cfg = config.get()
		if (!name) {
			console.error("No command provided")
			process.exit(1)
		}
		if (!cfg.accessToken) {
			console.error("Please authenticate with: mcx auth login")
			process.exit(1)
		}

		let finalCmd = flags.cmd
		let finalArgs = args

		let image: string | undefined

		if (flags.docker) {
			// name is the Docker image
			image = name
			finalCmd = args[0] || undefined
			finalArgs = args.slice(1)
		}

		// ignore flags.yes as this runs from a MCP client

		try {
			// Only add -y for non Docker images
			const apiArgs = flags.docker ? finalArgs : ["-y", ...finalArgs]

			// parse environment variables from -e flags
			const env: Record<string, string> = {}
			if (flags.env) {
				for (const envVar of flags.env) {
					const [key, ...valueParts] = envVar.split("=")
					if (key) {
						env[key] = valueParts.join("=") || ""
					}
				}
			}

			const res = await api(cfg).run({
				name,
				cmd: finalCmd,
				args: apiArgs,
				image,
				env: Object.keys(env).length > 0 ? env : undefined,
			})

			await server(cfg, res)
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
			cmd: {
				brief: "Command",
				kind: "parsed",
				parse: String,
				optional: true,
			},
			docker: {
				brief: "Run a Docker image instead of a named server",
				kind: "boolean",
				optional: true,
			},
			env: {
				brief: "Set environment variables (can be used multiple times)",
				kind: "parsed",
				parse: String,
				variadic: true,
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
			e: "env",
		},
	},
})
