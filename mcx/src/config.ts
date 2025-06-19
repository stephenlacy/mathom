import path from "node:path"
import fs from "node:fs"

export type Config = {
	accessToken?: string
	apiUrl?: string
}

// @ts-ignore
const homeDir = process.env.HOME || process.env.USERPROFILE
const configDir = path.join(homeDir || "~", ".config")
const configFile = path.join(configDir, "recall", "config.json")

const get = () => {
	let config: Config = {}
	try {
		const file = fs.readFileSync(configFile, "utf-8")
		config = JSON.parse(file) as Config
		return config
	} catch (e) {
		console.error("Error reading config file", e)
		return config
	}
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
