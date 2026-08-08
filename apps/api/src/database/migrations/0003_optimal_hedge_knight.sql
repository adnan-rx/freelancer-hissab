ALTER TABLE "users" ADD COLUMN "bank_name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_title" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "iban" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pseb_id" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_filer" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invoice_prefix" varchar(50) DEFAULT 'FH-2026-';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_terms" varchar(100) DEFAULT 'Due on Receipt';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invoice_notes" varchar(1000);