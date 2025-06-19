CREATE TABLE "cli_verifications" (
	"code" text PRIMARY KEY NOT NULL,
	"access_token" text,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"completed" boolean DEFAULT false
);
