ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "exchange_rate" numeric(10, 4) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "amount_pkr" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
--> backfill: PKR expenses were already stored in rupees; foreign-currency rows were
--> previously summed as if they were PKR, so convert them at the historical fallback rate.
UPDATE "expenses" SET "exchange_rate" = '1', "amount_pkr" = "amount" WHERE "currency" = 'PKR';--> statement-breakpoint
UPDATE "expenses" SET "exchange_rate" = '280.5000', "amount_pkr" = ROUND("amount" * 280.50, 2) WHERE "currency" <> 'PKR';