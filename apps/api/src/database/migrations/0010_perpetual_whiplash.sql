CREATE TABLE "platform_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" varchar(50) NOT NULL,
	"account_identifier" varchar(255) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp,
	"status" varchar(50) DEFAULT 'connected' NOT NULL,
	"last_sync_at" timestamp,
	"last_successful_sync_at" timestamp,
	"sync_status" varchar(50) DEFAULT 'idle' NOT NULL,
	"last_sync_error" text,
	"synced_transactions_count" integer DEFAULT 0 NOT NULL,
	"failed_transactions_count" integer DEFAULT 0 NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" varchar(50) NOT NULL,
	"sync_type" varchar(50) DEFAULT 'manual' NOT NULL,
	"status" varchar(50) NOT NULL,
	"since_timestamp" timestamp,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"income_created_count" integer DEFAULT 0 NOT NULL,
	"expenses_created_count" integer DEFAULT 0 NOT NULL,
	"clients_created_count" integer DEFAULT 0 NOT NULL,
	"invoices_created_count" integer DEFAULT 0 NOT NULL,
	"duplicates_skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_sync_logs" ADD CONSTRAINT "platform_sync_logs_connection_id_platform_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."platform_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_sync_logs" ADD CONSTRAINT "platform_sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_conn_user_id_idx" ON "platform_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "platform_conn_platform_user_idx" ON "platform_connections" USING btree ("platform","user_id");--> statement-breakpoint
CREATE INDEX "platform_sync_log_conn_id_idx" ON "platform_sync_logs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "platform_sync_log_user_id_idx" ON "platform_sync_logs" USING btree ("user_id");