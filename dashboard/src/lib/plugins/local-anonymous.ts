import { createAuthEndpoint } from "better-auth/api"
import type { BetterAuthPlugin, User, AuthPluginSchema, InferOptionSchema } from "better-auth"
import { setSessionCookie } from "better-auth/cookies"
import { mergeSchema } from "better-auth/db"

export interface UserWithAnonymous extends User {
	isAnonymous: boolean
}

export interface LocalAnonymousOptions {
	userId?: string
	// Static email to use for local development
	email?: string
	name?: string
	schema?: InferOptionSchema<typeof schema>
}

const schema = {
	user: {
		fields: {
			isAnonymous: {
				type: "boolean",
				required: false,
			},
		},
	},
} satisfies AuthPluginSchema

export const localAnonymous = (options?: LocalAnonymousOptions) => {
	const STATIC_EMAIL = options?.email || "local@anonymous.dev"
	const STATIC_NAME = options?.name || "Local Anonymous User"

	const ERROR_CODES = {
		FAILED_TO_CREATE_USER: "Failed to create user",
		COULD_NOT_CREATE_SESSION: "Could not create session",
		NOT_LOCAL_MODE: "Local anonymous plugin only works in local mode",
	} as const

	return {
		id: "local-anonymous",
		endpoints: {
			signInAnonymous: createAuthEndpoint(
				"/sign-in/anonymous",
				{
					method: "POST",
					metadata: {
						openapi: {
							description: "Sign in anonymously (local mode)",
							responses: {
								200: {
									description: "Sign in anonymously",
									content: {
										"application/json": {
											schema: {
												type: "object",
												properties: {
													user: {
														$ref: "#/components/schemas/User",
													},
													session: {
														$ref: "#/components/schemas/Session",
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				async (ctx) => {
					if (process.env.MODE !== "local") {
						throw ctx.error("BAD_REQUEST", {
							message: ERROR_CODES.NOT_LOCAL_MODE,
						})
					}

					// First try to find existing user
					let user: UserWithAnonymous | null = null
					try {
						const userResult = await ctx.context.internalAdapter.findUserByEmail(STATIC_EMAIL)
						user = userResult?.user as UserWithAnonymous | null
					} catch (error) {
						// ignore error
					}

					if (!user) {
						const newUser = await ctx.context.internalAdapter.createUser(
							{
								email: STATIC_EMAIL,
								emailVerified: false,
								isAnonymous: true,
								name: STATIC_NAME,
								createdAt: new Date(),
								updatedAt: new Date(),
							},
							ctx,
						)
						if (!newUser) {
							throw ctx.error("INTERNAL_SERVER_ERROR", {
								message: ERROR_CODES.FAILED_TO_CREATE_USER,
							})
						}
						user = newUser as UserWithAnonymous
					}

					// Create session
					const session = await ctx.context.internalAdapter.createSession(user.id, ctx.request)
					if (!session) {
						return ctx.json(null, {
							status: 400,
							body: {
								message: ERROR_CODES.COULD_NOT_CREATE_SESSION,
							},
						})
					}

					// Set session cookie
					await setSessionCookie(ctx, {
						session: session,
						user: user,
					})

					return ctx.json({
						token: session.token,
						user: {
							id: user.id,
							email: user.email,
							emailVerified: user.emailVerified,
							name: user.name,
							createdAt: user.createdAt,
							updatedAt: user.updatedAt,
						},
					})
				},
			),
		},
		schema: mergeSchema(schema, options?.schema),
		$ERROR_CODES: ERROR_CODES,
	} satisfies BetterAuthPlugin
}

