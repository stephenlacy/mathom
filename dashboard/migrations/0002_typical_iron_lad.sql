CREATE TABLE "instances" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"updated_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"user_id" uuid NOT NULL,
	"runtime" text NOT NULL,
	"name" text NOT NULL,
	"cmd" text NOT NULL,
	"args" jsonb NOT NULL,
	"status" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;