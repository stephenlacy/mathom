/*
 *
 * adapted from https://github.com/cloudflare/workers-oauth-provider
 * */

import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/db/drizzle"
import { oauthClients, oauthGrants, oauthTokens } from "@/db/schema/oauth"
import { and, eq } from "drizzle-orm"
import { typeid, TypeID } from "typeid-js"
import { auth } from "@/lib/auth"

// Constants
const TOKEN_LENGTH = 32
const DEFAULT_ACCESS_TOKEN_TTL = 60 * 60 // 1 hour in seconds
const GRANT_TYPES = ["authorization_code", "refresh_token"]
const DEFAULT_AUTH_METHOD = "client_secret_basic"

// Types
export interface AuthRequest {
	responseType: string
	clientId: string
	redirectUri: string
	scope: string[]
	state: string
	codeChallenge?: string
	codeChallengeMethod?: string
}

export interface CompleteAuthorizationOptions {
	request: AuthRequest
	userId: string
	metadata: any
	scope: string[]
	props: any
}

const corsHeaders = () => ({
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
	"Content-Type": "application/json",
	"Access-Control-Allow-Credentials": "true",
})

/**
 * Parses an OAuth authorization request from the HTTP request
 */
export async function parseAuthRequest(request: NextRequest): Promise<AuthRequest> {
	const url = new URL(request.url)
	const responseType =
		url.searchParams.get("responseType") || url.searchParams.get("response_type") || ""
	const clientId = url.searchParams.get("clientId") || url.searchParams.get("client_id") || ""
	const redirectUri =
		url.searchParams.get("redirectUri") || url.searchParams.get("redirect_uri") || ""
	const scope = (url.searchParams.get("scope") || "").split(" ").filter(Boolean)
	const state = url.searchParams.get("state") || ""
	const codeChallenge =
		url.searchParams.get("codeChallenge") || url.searchParams.get("code_challenge") || undefined
	const codeChallengeMethod =
		url.searchParams.get("codeChallengeMethod") ||
		url.searchParams.get("code_challenge_method") ||
		"plain"

	return {
		responseType,
		clientId,
		redirectUri,
		scope,
		state,
		codeChallenge,
		codeChallengeMethod,
	}
}

/**
 * Looks up a client by its client ID
 */
export async function lookupClient(clientId: string) {
	const clients = await db
		.select()
		.from(oauthClients)
		.where(eq(oauthClients.clientId, clientId))
		.limit(1)

	return clients[0]
}

/**
 * Updates client information in the database
 */
export async function updateClient(clientId: string, data: Partial<any>) {
	return db.update(oauthClients).set(data).where(eq(oauthClients.clientId, clientId)).returning()
}

/**
 * Helper function to generate a random string
 */
export function generateRandomString(length: number): string {
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	let result = ""
	const values = new Uint8Array(length)
	crypto.getRandomValues(values)
	for (let i = 0; i < length; i++) {
		result += characters.charAt(values[i] % characters.length)
	}
	return result
}

/**
 * Generates a token ID by hashing the token value using SHA-256
 */
export async function generateTokenId(token: string): Promise<string> {
	const encoder = new TextEncoder()
	const data = encoder.encode(token)
	const hashBuffer = await crypto.subtle.digest("SHA-256", data)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
	return hashHex
}

/**
 * Encodes an ArrayBuffer as base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

/**
 * Decodes a base64 string to an ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64)
	const bytes = new Uint8Array(binaryString.length)
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i)
	}
	return bytes.buffer
}

/**
 * Encrypts props data with a newly generated key
 */
export async function encryptProps(data: any): Promise<{ encryptedData: string; key: CryptoKey }> {
	// Generate a new encryption key
	const key = await crypto.subtle.generateKey(
		{
			name: "AES-GCM",
			length: 256,
		},
		true, // extractable
		["encrypt", "decrypt"],
	)

	// Use a constant IV (all zeros) since each key is used only once
	const iv = new Uint8Array(12)

	// Convert data to string
	const jsonData = JSON.stringify(data)
	const encoder = new TextEncoder()
	const encodedData = encoder.encode(jsonData)

	// Encrypt the data
	const encryptedBuffer = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv,
		},
		key,
		encodedData,
	)

	// Convert to base64 for storage
	return {
		encryptedData: arrayBufferToBase64(encryptedBuffer),
		key,
	}
}

/**
 * Decrypts encrypted props data using the provided key
 */
export async function decryptProps(key: CryptoKey, encryptedData: string): Promise<any> {
	// Convert base64 string back to ArrayBuffer
	const encryptedBuffer = base64ToArrayBuffer(encryptedData)

	// Use the same constant IV (all zeros) that was used for encryption
	const iv = new Uint8Array(12)

	// Decrypt the data
	const decryptedBuffer = await crypto.subtle.decrypt(
		{
			name: "AES-GCM",
			iv,
		},
		key,
		encryptedBuffer,
	)

	// Convert the decrypted buffer to a string, then parse as JSON
	const decoder = new TextDecoder()
	const jsonData = decoder.decode(decryptedBuffer)
	return JSON.parse(jsonData)
}

/**
 * Derives a wrapping key from a token string
 */
export async function deriveKeyFromToken(tokenStr: string): Promise<CryptoKey> {
	const encoder = new TextEncoder()

	// Use a constant key for HMAC
	const WRAPPING_KEY_HMAC_KEY = new Uint8Array([
		0x22, 0x7e, 0x26, 0x86, 0x8d, 0xf1, 0xe1, 0x6d, 0x80, 0x70, 0xea, 0x17, 0x97, 0x5b, 0x47, 0xa6,
		0x82, 0x18, 0xfa, 0x87, 0x28, 0xae, 0xde, 0x85, 0xb5, 0x1d, 0x4a, 0xd9, 0x96, 0xca, 0xca, 0x43,
	])

	// Import the pre-defined HMAC key
	const hmacKey = await crypto.subtle.importKey(
		"raw",
		WRAPPING_KEY_HMAC_KEY,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	)

	// Use HMAC-SHA256 to derive the wrapping key material
	const hmacResult = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(tokenStr))

	// Import the HMAC result as the wrapping key
	return await crypto.subtle.importKey(
		"raw",
		hmacResult,
		{ name: "AES-KW" },
		false, // not extractable
		["wrapKey", "unwrapKey"],
	)
}

/**
 * Wraps an encryption key using a token-derived key
 */
export async function wrapKeyWithToken(tokenStr: string, keyToWrap: CryptoKey): Promise<string> {
	// Derive a key from the token
	const wrappingKey = await deriveKeyFromToken(tokenStr)

	// Wrap the encryption key
	const wrappedKeyBuffer = await crypto.subtle.wrapKey("raw", keyToWrap, wrappingKey, {
		name: "AES-KW",
	})

	// Convert to base64 for storage
	return arrayBufferToBase64(wrappedKeyBuffer)
}

/**
 * Unwraps an encryption key using a token-derived key
 */
export async function unwrapKeyWithToken(
	tokenStr: string,
	wrappedKeyBase64: string,
): Promise<CryptoKey> {
	// Derive a key from the token
	const wrappingKey = await deriveKeyFromToken(tokenStr)

	// Convert base64 wrapped key to ArrayBuffer
	const wrappedKeyBuffer = base64ToArrayBuffer(wrappedKeyBase64)

	// Unwrap the key
	return await crypto.subtle.unwrapKey(
		"raw",
		wrappedKeyBuffer,
		wrappingKey,
		{ name: "AES-KW" },
		{ name: "AES-GCM" },
		true, // extractable
		["encrypt", "decrypt"],
	)
}

/**
 * Completes an authorization request by creating a grant and authorization code
 */
export async function completeAuthorization(
	options: CompleteAuthorizationOptions,
): Promise<{ redirectTo: string }> {
	// Generate a unique grant ID using TypeID
	const grantId = typeid("oauth_grants").toString()

	// Encrypt the props data with a new key generated for this grant
	const { encryptedData, key: encryptionKey } = await encryptProps(options.props)

	// Generate an authorization code with embedded user and grant IDs
	const authCodeSecret = generateRandomString(32)
	const authCode = `${options.userId}:${grantId}:${authCodeSecret}`

	// Hash the authorization code
	const authCodeId = await generateTokenId(authCode)

	// Wrap the encryption key with the auth code
	const authCodeWrappedKey = await wrapKeyWithToken(authCode, encryptionKey)

	// Current timestamp
	const now = new Date()

	// Auth code expires in 10 minutes
	const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

	// Store the grant with the auth code hash
	await db.insert(oauthGrants).values({
		id: grantId,
		clientId: options.request.clientId,
		userId: options.userId,
		scope: options.scope,
		metadata: options.metadata,
		encryptedProps: encryptedData,
		authCodeId,
		authCodeWrappedKey,
		codeChallenge: options.request.codeChallenge,
		codeChallengeMethod: options.request.codeChallengeMethod,
		expiresAt,
	})

	// Build the redirect URL for authorization code flow
	const redirectUrl = new URL(options.request.redirectUri)
	redirectUrl.searchParams.set("code", authCode)
	if (options.request.state) {
		redirectUrl.searchParams.set("state", options.request.state)
	}

	return { redirectTo: redirectUrl.toString() }
}

/**
 * Validates authorization request parameters
 */
export async function validateAuthorizationRequest(
	request: AuthRequest,
	user: any,
): Promise<{
	isValid: boolean
	error?: string
	description?: string
}> {
	// Check if the required parameters are present
	if (!request.responseType) {
		return {
			isValid: false,
			error: "invalid_request",
			description: "Missing response_type parameter",
		}
	}

	if (request.responseType !== "code") {
		return {
			isValid: false,
			error: "unsupported_response_type",
			description: "Only code response type is supported",
		}
	}

	if (!request.clientId) {
		return { isValid: false, error: "invalid_request", description: "Missing client_id parameter" }
	}

	if (!request.redirectUri) {
		return {
			isValid: false,
			error: "invalid_request",
			description: "Missing redirect_uri parameter",
		}
	}

	// Look up the client
	const client = await lookupClient(request.clientId)
	if (!client) {
		return { isValid: false, error: "invalid_client", description: "Client not found" }
	}

	await updateClient(client.clientId, {
		userId: user.id,
	})

	// Validate redirect URI
	if (!client.redirectUris.includes(request.redirectUri)) {
		return {
			isValid: false,
			error: "invalid_request",
			description: "Redirect URI does not match registered URI",
		}
	}

	return { isValid: true }
}

/**
 * Creates an error redirect with OAuth parameters
 */
export function createErrorRedirect(
	redirectUri: string,
	error: string,
	description?: string,
	state?: string,
): string {
	const url = new URL(redirectUri)
	url.searchParams.set("error", error)

	if (description) {
		url.searchParams.set("error_description", description)
	}

	if (state) {
		url.searchParams.set("state", state)
	}

	return url.toString()
}

/**
 * Handles the auth code exchange for an access token
 */
export async function handleAuthorizationCodeGrant(
	code: string,
	redirectUri: string,
	clientId: string,
	clientSecret: string | null,
	codeVerifier?: string,
): Promise<{
	success: boolean
	data?: {
		access_token: string
		token_type: string
		expires_in: number
		refresh_token: string
		scope: string
	}
	error?: {
		error: string
		error_description: string
	}
}> {
	// Parse the authorization code to extract user ID and grant ID
	const codeParts = code.split(":")
	if (codeParts.length !== 3) {
		return {
			success: false,
			error: {
				error: "invalid_grant",
				error_description: "Invalid authorization code format",
			},
		}
	}

	const [userId, grantId, _] = codeParts

	const grants = await db
		.select()
		.from(oauthGrants)
		.where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.userId, userId)))
		.limit(1)

	const grant = grants[0]

	// Get the grant
	if (!grant) {
		return {
			success: false,
			error: {
				error: "invalid_grant",
				error_description: "Grant not found or authorization code expired",
			},
		}
	}

	// Verify that the grant contains an auth code hash
	if (!grant.authCodeId) {
		return {
			success: false,
			error: {
				error: "invalid_grant",
				error_description: "Authorization code already used",
			},
		}
	}

	// Verify the authorization code by comparing its hash to the one in the grant
	const codeHash = await generateTokenId(code)
	if (codeHash !== grant.authCodeId) {
		return {
			success: false,
			error: {
				error: "invalid_grant",
				error_description: "Invalid authorization code",
			},
		}
	}

	// Verify client ID matches
	if (grant.clientId !== clientId) {
		return {
			success: false,
			error: {
				error: "invalid_grant",
				error_description: "Client ID mismatch",
			},
		}
	}

	// Get client to verify credentials and redirect URI
	const client = await lookupClient(clientId)
	if (!client) {
		return {
			success: false,
			error: {
				error: "invalid_client",
				error_description: "Client not found",
			},
		}
	}

	// Check if PKCE is being used
	const isPkceEnabled = !!grant.codeChallenge

	// Verify redirect URI if provided
	if (redirectUri && !client.redirectUris.includes(redirectUri)) {
		return {
			success: false,
			error: {
				error: "invalid_grant",
				error_description: "Invalid redirect URI",
			},
		}
	}

	// Check if client is confidential and requires secret
	const isPublicClient = client.tokenEndpointAuthMethod === "none"
	if (!isPublicClient && client.clientSecret) {
		// Verify client secret for confidential clients
		if (!clientSecret) {
			return {
				success: false,
				error: {
					error: "invalid_client",
					error_description: "Client authentication failed: missing client_secret",
				},
			}
		}

		// Simple comparison for now, ideally should use a secure comparison
		if (clientSecret !== client.clientSecret) {
			return {
				success: false,
				error: {
					error: "invalid_client",
					error_description: "Client authentication failed: invalid client_secret",
				},
			}
		}
	}

	// Verify PKCE code_verifier if code_challenge was provided during authorization
	if (isPkceEnabled) {
		if (!codeVerifier) {
			return {
				success: false,
				error: {
					error: "invalid_request",
					error_description: "code_verifier is required for PKCE",
				},
			}
		}

		// Verify the code verifier against the stored code challenge
		let calculatedChallenge: string

		if (grant.codeChallengeMethod === "S256") {
			// SHA-256 transformation for S256 method
			const encoder = new TextEncoder()
			const data = encoder.encode(codeVerifier)
			const hashBuffer = await crypto.subtle.digest("SHA-256", data)
			const hashArray = Array.from(new Uint8Array(hashBuffer))
			// Base64 URL encode the hash
			calculatedChallenge = btoa(String.fromCharCode(...hashArray))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "")
		} else {
			// Plain method, direct comparison
			calculatedChallenge = codeVerifier
		}

		if (calculatedChallenge !== grant.codeChallenge) {
			return {
				success: false,
				error: {
					error: "invalid_grant",
					error_description: "Invalid PKCE code_verifier",
				},
			}
		}
	}

	// Code is valid - generate tokens
	const accessTokenSecret = generateRandomString(TOKEN_LENGTH)
	const refreshTokenSecret = generateRandomString(TOKEN_LENGTH)

	const accessToken = `${userId}:${grantId}:${accessTokenSecret}`
	const refreshToken = `${userId}:${grantId}:${refreshTokenSecret}`

	// Generate token IDs from the full token strings
	const accessTokenId = await generateTokenId(accessToken)
	const refreshTokenId = await generateTokenId(refreshToken)

	// Define access token TTL (1 hour by default)
	const accessTokenTTL = DEFAULT_ACCESS_TOKEN_TTL

	// Current timestamp
	const now = new Date()
	const accessTokenExpiresAt = new Date(now.getTime() + accessTokenTTL * 1000)

	// Get the encryption key for props by unwrapping it using the auth code
	if (!grant.authCodeWrappedKey) {
		return {
			success: false,
			error: {
				error: "server_error",
				error_description: "Missing wrapped key for authorization code",
			},
		}
	}

	const encryptionKey = await unwrapKeyWithToken(code, grant.authCodeWrappedKey)

	// Wrap the keys for the new tokens
	const accessTokenWrappedKey = await wrapKeyWithToken(accessToken, encryptionKey)
	const refreshTokenWrappedKey = await wrapKeyWithToken(refreshToken, encryptionKey)

	// Update the grant record: remove auth code, add refresh token
	await db
		.update(oauthGrants)
		.set({
			authCodeId: null,
			authCodeWrappedKey: null,
			codeChallenge: null,
			codeChallengeMethod: null,
			refreshTokenId,
			refreshTokenWrappedKey,
			expiresAt: null, // Grant doesn't expire after code exchange
		})
		.where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.userId, userId)))

	// Store the access token
	const tokenId = typeid("oauth_tokens").toString()
	await db.insert(oauthTokens).values({
		id: tokenId,
		grantId,
		userId,
		tokenId: accessTokenId,
		expiresAt: accessTokenExpiresAt,
		wrappedEncryptionKey: accessTokenWrappedKey,
		clientId: grant.clientId,
		scope: grant.scope,
		encryptedProps: grant.encryptedProps,
	})

	// Return the tokens
	return {
		success: true,
		data: {
			access_token: accessToken,
			token_type: "bearer",
			expires_in: accessTokenTTL,
			refresh_token: refreshToken,
			scope: grant.scope.join(" "),
		},
	}
}

/**
 * Handles refresh token grant to issue a new access token
 */
export async function handleRefreshTokenGrant(
	refreshToken: string,
	clientId: string,
	clientSecret: string | null,
): Promise<{
	success: boolean
	data?: {
		access_token: string
		token_type: string
		expires_in: number
		refresh_token: string
		scope: string
	}
	error?: {
		error: string
		error_description: string
	}
}> {
	// Parse the token to extract user ID and grant ID
	const tokenParts = refreshToken.split(":")
	if (tokenParts.length !== 3) {
		return {
			success: false,
			error: {
				error: "invalid_grant",
				error_description: "Invalid token format",
			},
		}
	}

	const [userId, grantId, _] = tokenParts

	// Calculate the token hash
	const providedTokenHash = await generateTokenId(refreshToken)

	// Get the associated grant
	const grants = await db
		.select()
		.from(oauthGrants)
		.where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.userId, userId)))
		.limit(1)

	const grant = grants[0]

	if (!grant) {
		return {
			success: false,
			error: {
				error: "invalid_grant",
				error_description: "Grant not found",
			},
		}
	}

	// Check if the provided token matches either the current or previous refresh token
	const isCurrentToken = grant.refreshTokenId === providedTokenHash
	const isPreviousToken = grant.previousRefreshTokenId === providedTokenHash

	if (!isCurrentToken && !isPreviousToken) {
		return {
			success: false,
			error: {
				error: "invalid_grant",
				error_description: "Invalid refresh token",
			},
		}
	}

	// Verify client ID matches
	if (grant.clientId !== clientId) {
		return {
			success: false,
			error: {
				error: "invalid_grant",
				error_description: "Client ID mismatch",
			},
		}
	}

	// Get client to verify credentials
	const client = await lookupClient(clientId)
	if (!client) {
		return {
			success: false,
			error: {
				error: "invalid_client",
				error_description: "Client not found",
			},
		}
	}

	// Check if client is confidential and requires secret
	const isPublicClient = client.tokenEndpointAuthMethod === "none"
	if (!isPublicClient && client.clientSecret) {
		// Verify client secret for confidential clients
		if (!clientSecret) {
			return {
				success: false,
				error: {
					error: "invalid_client",
					error_description: "Client authentication failed: missing client_secret",
				},
			}
		}

		// Simple comparison for now
		if (clientSecret !== client.clientSecret) {
			return {
				success: false,
				error: {
					error: "invalid_client",
					error_description: "Client authentication failed: invalid client_secret",
				},
			}
		}
	}

	// Generate new tokens
	const accessTokenSecret = generateRandomString(TOKEN_LENGTH)
	const newRefreshTokenSecret = generateRandomString(TOKEN_LENGTH)

	const newAccessToken = `${userId}:${grantId}:${accessTokenSecret}`
	const newRefreshToken = `${userId}:${grantId}:${newRefreshTokenSecret}`

	// Generate token IDs
	const accessTokenId = await generateTokenId(newAccessToken)
	const newRefreshTokenId = await generateTokenId(newRefreshToken)

	// Access token TTL
	const accessTokenTTL = DEFAULT_ACCESS_TOKEN_TTL

	// Current timestamp
	const now = new Date()
	const accessTokenExpiresAt = new Date(now.getTime() + accessTokenTTL * 1000)

	// Determine which wrapped key to use for unwrapping
	let wrappedKeyToUse: string
	if (isCurrentToken && grant.refreshTokenWrappedKey) {
		wrappedKeyToUse = grant.refreshTokenWrappedKey
	} else if (isPreviousToken && grant.previousRefreshTokenWrappedKey) {
		wrappedKeyToUse = grant.previousRefreshTokenWrappedKey
	} else {
		return {
			success: false,
			error: {
				error: "server_error",
				error_description: "Missing wrapped key for refresh token",
			},
		}
	}

	// Unwrap the encryption key using the refresh token
	const encryptionKey = await unwrapKeyWithToken(refreshToken, wrappedKeyToUse)

	// Wrap keys for the new tokens
	const accessTokenWrappedKey = await wrapKeyWithToken(newAccessToken, encryptionKey)
	const newRefreshTokenWrappedKey = await wrapKeyWithToken(newRefreshToken, encryptionKey)

	// Update the grant with token rotation
	// Current token becomes previous, new token becomes current
	await db
		.update(oauthGrants)
		.set({
			previousRefreshTokenId: providedTokenHash,
			previousRefreshTokenWrappedKey: wrappedKeyToUse,
			refreshTokenId: newRefreshTokenId,
			refreshTokenWrappedKey: newRefreshTokenWrappedKey,
		})
		.where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.userId, userId)))

	// Store the new access token
	const tokenId = typeid("oauth_tokens").toString()
	await db.insert(oauthTokens).values({
		id: tokenId,
		grantId,
		userId,
		tokenId: accessTokenId,
		expiresAt: accessTokenExpiresAt,
		wrappedEncryptionKey: accessTokenWrappedKey,
		clientId: grant.clientId,
		scope: grant.scope,
		encryptedProps: grant.encryptedProps,
	})

	// Return the new tokens
	return {
		success: true,
		data: {
			access_token: newAccessToken,
			token_type: "bearer",
			expires_in: accessTokenTTL,
			refresh_token: newRefreshToken,
			scope: grant.scope.join(" "),
		},
	}
}

/**
 * Handle an OAuth token request from clients
 */
export async function handleTokenRequest(request: NextRequest): Promise<NextResponse> {
	// Only accept POST requests
	if (request.method !== "POST") {
		return NextResponse.json(
			{ error: "invalid_request", error_description: "Method not allowed" },
			{ status: 405 },
		)
	}

	// Check content type
	const contentType = request.headers.get("content-type") || ""
	if (!contentType.includes("application/x-www-form-urlencoded")) {
		return NextResponse.json(
			{
				error: "invalid_request",
				error_description: "Content-Type must be application/x-www-form-urlencoded",
			},
			{ status: 400 },
		)
	}

	// Parse form data
	const formData = await request.formData()
	const body: Record<string, string> = {}
	for (const [key, value] of formData.entries()) {
		body[key] = value.toString()
	}

	// Get client authentication
	const authHeader = request.headers.get("authorization")
	let clientId = ""
	let clientSecret: string | null = null

	if (authHeader?.startsWith("Basic ")) {
		// Basic auth
		const credentials = atob(authHeader.substring(6))
		const [id, secret] = credentials.split(":")
		clientId = id
		clientSecret = secret || null
	} else {
		// Form parameters
		clientId = body.client_id
		clientSecret = body.client_secret || null
	}

	if (!clientId) {
		console.error("Client ID is required")
		return NextResponse.json(
			{ error: "invalid_client", error_description: "Client ID is required" },
			{ status: 401 },
		)
	}

	// Handle different grant types
	const grantType = body.grant_type

	if (grantType === "authorization_code") {
		const result = await handleAuthorizationCodeGrant(
			body.code,
			body.redirect_uri,
			clientId,
			clientSecret,
			body.code_verifier,
		)

		if (result.success && result.data) {
			return NextResponse.json(result.data, { headers: corsHeaders() })
		}
		return NextResponse.json(result.error, { status: 400 })
	}

	if (grantType === "refresh_token") {
		const result = await handleRefreshTokenGrant(body.refresh_token, clientId, clientSecret)
		// console.log("result", result)

		if (result.success && result.data) {
			return NextResponse.json(result.data, { headers: corsHeaders() })
		}
		return NextResponse.json(result.error, { status: 400 })
	}
	return NextResponse.json(
		{ error: "unsupported_grant_type", error_description: "Grant type not supported" },
		{ status: 400 },
	)
}

/**
 * Handles client registration requests
 */
export async function handleClientRegistration(request: NextRequest): Promise<NextResponse> {
	// Only accept POST requests
	if (request.method !== "POST") {
		return NextResponse.json(
			{ error: "invalid_request", error_description: "Method not allowed" },
			{ status: 405 },
		)
	}

	// Check content length to ensure it's not too large (1 MiB limit)
	const contentLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10)
	if (contentLength > 1048576) {
		// 1 MiB = 1048576 bytes
		return NextResponse.json(
			{
				error: "invalid_request",
				error_description: "Request payload too large, must be under 1 MiB",
			},
			{ status: 413 },
		)
	}

	try {
		// Parse client metadata
		const clientMetadata = await request.json()

		// Get token endpoint auth method, default to client_secret_basic
		const authMethod =
			validateStringField(clientMetadata.token_endpoint_auth_method) || DEFAULT_AUTH_METHOD
		const isPublicClient = authMethod === "none"

		// Create client ID
		const clientId = generateRandomString(16)

		// Only create client secret for confidential clients
		let clientSecret: string | undefined

		if (!isPublicClient) {
			clientSecret = generateRandomString(32)
		}

		try {
			// Validate redirect URIs - must exist and have at least one entry
			const redirectUris = validateStringArray(clientMetadata.redirect_uris)
			if (!redirectUris || redirectUris.length === 0) {
				throw new Error("At least one redirect URI is required")
			}

			// Create the client record
			const clientInfo = {
				clientId,
				clientSecret,
				redirectUris,
				clientName: validateStringField(clientMetadata.client_name),
				logoUri: validateStringField(clientMetadata.logo_uri),
				clientUri: validateStringField(clientMetadata.client_uri),
				policyUri: validateStringField(clientMetadata.policy_uri),
				tosUri: validateStringField(clientMetadata.tos_uri),
				jwksUri: validateStringField(clientMetadata.jwks_uri),
				contacts: validateStringArray(clientMetadata.contacts) || [],
				grantTypes: validateStringArray(clientMetadata.grant_types) || GRANT_TYPES,
				responseTypes: validateStringArray(clientMetadata.response_types) || ["code"],
				tokenEndpointAuthMethod: authMethod,
			}

			// Store the client in the database with the authenticated user
			await db.insert(oauthClients).values({
				// userId: session.user.id,
				// @ts-ignore
				userId: null, // user id is stored from the web UI request
				clientId,
				clientSecret,
				redirectUris,
				clientName: clientInfo.clientName,
				logoUri: clientInfo.logoUri,
				clientUri: clientInfo.clientUri,
				policyUri: clientInfo.policyUri,
				tosUri: clientInfo.tosUri,
				jwksUri: clientInfo.jwksUri,
				contacts: clientInfo.contacts,
				grantTypes: clientInfo.grantTypes,
				responseTypes: clientInfo.responseTypes,
				tokenEndpointAuthMethod: authMethod,
				registrationDate: new Date(),
			})

			// Build the response
			const response: Record<string, any> = {
				client_id: clientInfo.clientId,
				redirect_uris: clientInfo.redirectUris,
				client_name: clientInfo.clientName,
				logo_uri: clientInfo.logoUri,
				client_uri: clientInfo.clientUri,
				policy_uri: clientInfo.policyUri,
				tos_uri: clientInfo.tosUri,
				jwks_uri: clientInfo.jwksUri,
				contacts: clientInfo.contacts,
				grant_types: clientInfo.grantTypes,
				response_types: clientInfo.responseTypes,
				token_endpoint_auth_method: clientInfo.tokenEndpointAuthMethod,
				client_id_issued_at: Math.floor(Date.now() / 1000),
			}

			// Only include client_secret for confidential clients
			if (clientSecret) {
				response.client_secret = clientSecret
			}

			return NextResponse.json(response, { status: 201, headers: corsHeaders() })
		} catch (error) {
			return NextResponse.json(
				{
					error: "invalid_client_metadata",
					error_description: error instanceof Error ? error.message : "Invalid client metadata",
				},
				{ status: 400 },
			)
		}
	} catch (error) {
		console.error("Error handling client registration:", error)
		return NextResponse.json(
			{ error: "invalid_request", error_description: "Invalid JSON payload" },
			{ status: 400 },
		)
	}
}

// Basic validation functions
const validateStringField = (field: any): string | undefined => {
	if (field === undefined) {
		return undefined
	}
	if (typeof field !== "string") {
		throw new Error("Field must be a string")
	}
	return field
}

const validateStringArray = (arr: any): string[] | undefined => {
	if (arr === undefined) {
		return undefined
	}
	if (!Array.isArray(arr)) {
		throw new Error("Field must be an array")
	}

	// Validate all elements are strings
	for (const item of arr) {
		if (typeof item !== "string") {
			throw new Error("All array elements must be strings")
		}
	}

	return arr
}
