CREATE TABLE "oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"updated_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"user_id" uuid,
	"client_id" text NOT NULL,
	"client_secret" text,
	"redirect_uris" jsonb NOT NULL,
	"client_name" text,
	"logo_uri" text,
	"client_uri" text,
	"policy_uri" text,
	"tos_uri" text,
	"jwks_uri" text,
	"contacts" jsonb,
	"grant_types" jsonb DEFAULT '["authorization_code", "refresh_token"]' NOT NULL,
	"response_types" jsonb DEFAULT '["code"]' NOT NULL,
	"registration_date" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"token_endpoint_auth_method" text DEFAULT 'client_secret_basic' NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_grants" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"updated_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"scope" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"encrypted_props" text NOT NULL,
	"refresh_token_id" text,
	"refresh_token_wrapped_key" text,
	"previous_refresh_token_id" text,
	"previous_refresh_token_wrapped_key" text,
	"auth_code_id" text,
	"auth_code_wrapped_key" text,
	"code_challenge" text,
	"code_challenge_method" text,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"updated_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"grant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"wrapped_encryption_key" text NOT NULL,
	"client_id" text NOT NULL,
	"scope" jsonb NOT NULL,
	"encrypted_props" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_grant_id_oauth_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."oauth_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;