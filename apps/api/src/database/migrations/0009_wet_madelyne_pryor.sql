ALTER TABLE "expenses" ADD COLUMN "payment_method" varchar(50) DEFAULT 'bank_transfer' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "name" varchar(255) DEFAULT 'Unnamed Asset' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "currency" varchar(10) DEFAULT 'PKR' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "balance" numeric(14, 2) DEFAULT '0' NOT NULL;