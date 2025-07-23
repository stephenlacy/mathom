export const config = {
	isLocal: process.env.NEXT_PUBLIC_MODE === "local" || process.env.MODE === "local",
}
