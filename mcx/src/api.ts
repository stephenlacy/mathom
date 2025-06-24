import { config, type Config } from "./config"

const DEFAULT_TIMEOUT = 20000
export const DEFAULT_API_URL = "http://localhost:5050/api/v1"

const request = async <T>({
	path,
	method,
	body,
	accessToken,
	cfg,
}: {
	path: string
	method: string
	body?: any
	accessToken?: string
	cfg: Config
}) => {
	const headers: any = {
		"Content-Type": "application/json",
	}
	if (accessToken) {
		headers["x-api-key"] = accessToken
	}

	return fetch(`${cfg.apiUrl || DEFAULT_API_URL}${path}`, {
		method,
		headers,
		body: ["POST", "PUT"].includes(method) ? JSON.stringify(body) : undefined,
		signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
	}).then((res) => {
		if (!res.ok) {
			throw new Error(`Error: ${res.status} ${res.statusText}`)
		}
		return res.json() as T
	})
}

export type ApiResponses = {
	instances: {
		run: {
			id: string
			uri: string
		}
	}
}

export const api = (cfg: Config) => {
	return {
		run: async ({
			name,
			cmd,
			args,
		}: { name: string; cmd?: string; args: string[] }): Promise<
			ApiResponses["instances"]["run"]
		> => {
			return request<ApiResponses["instances"]["run"]>({
				path: "/instances/run",
				method: "POST",
				accessToken: cfg.accessToken,
				cfg,
				body: {
					name,
					cmd,
					args,
				},
			})
		},
		// run
		// deploy
		// stop
		// delete
		// status
	}
}
