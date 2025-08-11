import path from "node:path"
import fs from "node:fs"

export type Config = {
	accessToken?: string
	apiUrl?: string
}

const DEFAULT_API_URL = "http://localhost:5050/api/v1"

// @ts-ignore
const homeDir = process.env.HOME || process.env.USERPROFILE
const configDir = path.join(homeDir || "~", ".config")
const configFile = path.join(configDir, "mathom", "config.json")

const get = () => {
	let config: Config = {}
	try {
		const file = fs.readFileSync(configFile, "utf-8")
		config = JSON.parse(file) as Config
	} catch (e) {
		// Ignore file read errors, just use empty config
	}

	const mathomUrl = process.env["MATHOM_URL"]
	if (mathomUrl) {
		const url = new URL(mathomUrl)
		url.pathname = path.join(url.pathname, "/api/v1")
		config.apiUrl = url.toString()
	}

	if (!config.apiUrl) {
		config.apiUrl = DEFAULT_API_URL
	}

	return config
}
const set = (params: Partial<Config>) => {
	const config: Config = {
		...get(),
		...params,
	}
	try {
		fs.mkdirSync(path.dirname(configFile), { recursive: true })
		fs.writeFileSync(configFile, JSON.stringify(config, null, 2))
		return config
	} catch (e) {
		console.error("Error writing config file", e)
	}
}

export const config = {
	get,
	set,
}
