ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_title" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "iban" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pseb_id" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_filer" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invoice_prefix" varchar(50) DEFAULT 'FH-2026-';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payment_terms" varchar(100) DEFAULT 'Due on Receipt';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invoice_notes" varchar(1000);