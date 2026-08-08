ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_name" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_title" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "iban" varchar(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pseb_id" varchar(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_filer" boolean DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invoice_prefix" varchar(50) DEFAULT 'FH-2026-';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payment_terms" varchar(100) DEFAULT 'Due on Receipt';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invoice_notes" varchar(1000);
