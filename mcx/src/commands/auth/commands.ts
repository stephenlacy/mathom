import { buildCommand, buildRouteMap } from "@stricli/core"
import color from "picocolors"
import { config } from "../../config"
import { spawn } from "node:child_process"
import { customAlphabet } from "nanoid"
const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ", 6)

type Flags = {}

const openBrowser = (url: string) => {
	const platform = process.platform
	let command: string

	if (platform === "darwin") {
		command = "open"
	} else if (platform === "win32") {
		command = "start"
	} else {
		command = "xdg-open"
	}

	spawn(command, [url], { detached: true, stdio: "ignore" })
}

const displayCliVibes = (code: string) => {
	const cc = color.cyan(color.bold(code))
	console.log("\n┌─────────────────────────────────────┐")
	console.log("│             MCX LOGIN               │")
	console.log("├─────────────────────────────────────┤")
	console.log("│                                     │")
	console.log(`│   Your verification code is:        │`)
	console.log(`│                                     │`)
	console.log(`│              ${cc}                 │`)
	console.log("│                                     │")
	console.log("│   Please confirm in your browser    │")
	console.log("│                                     │")
	console.log("└─────────────────────────────────────┘")
	console.log("\nWaiting for confirmation...\n")
}

const createVerification = async (code: string) => {
	const cfg = config.get()
	const apiUrl = cfg.apiUrl

	const response = await fetch(`${apiUrl}/auth/cli-verification`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ code }),
	})

	if (!response.ok) {
		throw new Error(`Failed to create verification: ${response.status}`)
	}

	return response.json()
}

const pollForCompletion = async (code: string): Promise<string> => {
	const cfg = config.get()
	const apiUrl = cfg.apiUrl

	for (let i = 0; i < 60; i++) {
		try {
			const response = await fetch(`${apiUrl}/auth/cli-verification/${code}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			})

			if (response.ok) {
				const data = (await response.json()) as { accessToken?: string; status?: string }
				if (data.accessToken) {
					return data.accessToken
				}
			}
		} catch (error) {
			// continue
		}

		await new Promise((resolve) => setTimeout(resolve, 2000))
	}

	throw new Error("Authentication timeout after 2 minutes")
}

export const loginCommand = buildCommand({
	func: async (flags: Flags) => {
		try {
			const code = nanoid()
			const cfg = config.get()
			const baseUrl = cfg.apiUrl!.replace("/api/v1", "")

			await createVerification(code)

			displayCliVibes(code)

			const authUrl = `${baseUrl}/cli?code=${code}`
			openBrowser(authUrl)

			// Poll for completion
			const accessToken = await pollForCompletion(code)

			config.set({ accessToken })

			console.log(color.bold(color.green("Authenticated!")))
		} catch (error) {
			console.log(
				`\nAuthentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
			process.exit(1)
		}
	},
	docs: {
		brief: "Log in",
	},
	parameters: {
		flags: {},
		positional: {
			kind: "tuple",
			parameters: [],
		},
	},
})

export const logoutCommand = buildCommand({
	func: (flags: Flags) => {},
	docs: {
		brief: "Log out",
	},
	parameters: {
		flags: {},
		positional: {
			kind: "tuple",
			parameters: [],
		},
	},
})

export const authRoutes = buildRouteMap({
	routes: {
		login: loginCommand,
		logout: logoutCommand,
	},
	docs: {
		brief: "Authentication commands",
	},
})
