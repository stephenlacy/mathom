import { sql } from "drizzle-orm"
import { customType, timestamp, type PgTableWithColumns } from "drizzle-orm/pg-core"
import { TypeID, typeid } from "typeid-js"

export const genId = (
	table:
		| Partial<
				PgTableWithColumns<{
					name: string
					schema: any
					columns: any
					dialect: "mysql"
				}>
		  >
		| string,
	suffix?: string,
) => {
	const name =
		(typeof table === "string"
			? table
			: // @ts-ignore
				(table[Symbol.for("drizzle:Name")] as string)) + (suffix ? `_${suffix}` : "")
	return typeid(name).toString()
}

export const nullableTypeId = (name: string, column = "id") => {
	return customType<{
		data: string
		notNull: true
	}>({
		dataType: () => {
			return "uuid"
		},
		fromDriver: (val: unknown) => {
			const parsed = TypeID.fromUUID(name, val as string)
			return parsed.toString()
		},
		toDriver: (val) => {
			if (!val) return null
			const parsed = TypeID.fromString(val).toUUID()
			return parsed
		},
	})(column) // .$defaultFn(() => typeid(name).toString())
}

export const typeId = (name: string, column = "id") => {
	return nullableTypeId(name, column).notNull()
}

export const defaults = (table: string) => ({
	id: typeId(table).primaryKey().default(sql`uuid_generate_v7()`),
	createdAt: timestamp("created_at").notNull().default(sql`timezone('utc', now())`),
	updatedAt: timestamp("updated_at").notNull().default(sql`timezone('utc', now())`),
})
