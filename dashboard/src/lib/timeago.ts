// https://github.com/yocontra/thenceforth

const MILISECOND = 1000
const MINUTE = 60 * MILISECOND
const TWO_MINUTES = 2 * MINUTE
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

const months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
]
const days = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
]

export function timeago(input: Date | string, opts?: any) {
	let i = input
	let o = opts
	if (!o) o = {}
	if (typeof i === "string") i = new Date(i)
	if (o.pretty) return prettyDate(i)
	const now = new Date()
	const diff = now.getTime() - i.getTime()

	if (diff < MINUTE) {
		return "Just now"
	}
	if (diff < TWO_MINUTES) {
		return "1 minute ago"
	}
	if (diff < HOUR) {
		const minutes = Math.round(diff / MINUTE)
		if (minutes === 1) return `${minutes} minute ago`
		return `${minutes} minutes ago`
	}
	if (diff < DAY) {
		const hours = Math.round(diff / HOUR)
		if (hours === 1) return `${hours} hour ago`
		return `${hours} hours ago`
	}
	if (diff < DAY * 2) {
		return "Yesterday"
	}
	if (diff < WEEK) {
		const days = Math.round(diff / DAY)
		if (days === 1) return `${days} day ago`
		return `${days} days ago`
	}
	if (diff > WEEK) {
		if (o.pretty !== false) return prettyDate(i)
		let m = String(1 + i.getMonth())
		if (m.length < 1) m = `0${m}`
		let d = String(i.getDate())
		if (d.length < 1) d = `0${d}`
		const y = i.getFullYear()
		return `${m}/${d}/${y}`
	}
	return String(i)
}

function prettyDate(i: Date) {
	const m = months[i.getMonth()]
	const d = i.getDate()
	const day = days[i.getDay() + 1]
	const y = i.getFullYear()
	return `${day} ${m} ${d}, ${y}`
}
