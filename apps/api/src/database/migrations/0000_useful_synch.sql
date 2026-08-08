CREATE TYPE "public"."auth_provider" AS ENUM('credentials', 'google');--> statement-breakpoint
CREATE TYPE "public"."category_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."client_platform" AS ENUM('upwork', 'fiverr', 'freelancer', 'direct', 'other');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('software', 'hardware', 'internet', 'office', 'travel', 'food', 'marketing', 'education', 'tax', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"name" varchar(255) NOT NULL,
	"business_name" varchar(255),
	"phone" varchar(50),
	"default_currency" varchar(3) DEFAULT 'PKR' NOT NULL,
	"timezone" varchar(100) DEFAULT 'Asia/Karachi' NOT NULL,
	"avatar_url" varchar(500),
	"auth_provider" "auth_provider" DEFAULT 'credentials' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"company" varchar(255),
	"platform" "client_platform" DEFAULT 'direct' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"notes" text,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"exchange_rate" numeric(10, 4) DEFAULT '1' NOT NULL,
	"total_pkr" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"due_date" date,
	"paid_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"rate" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid,
	"invoice_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"exchange_rate" numeric(10, 4) DEFAULT '1' NOT NULL,
	"amount_pkr" numeric(12, 2) NOT NULL,
	"platform" "client_platform" DEFAULT 'direct' NOT NULL,
	"description" varchar(500) NOT NULL,
	"category" varchar(100),
	"received_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'PKR' NOT NULL,
	"category" "expense_category" DEFAULT 'other' NOT NULL,
	"description" varchar(500) NOT NULL,
	"vendor" varchar(255),
	"receipt_url" varchar(1000),
	"expense_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "category_type" NOT NULL,
	"color" varchar(7) DEFAULT '#000000',
	"icon" varchar(50),
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "client_user_id_idx" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoice_user_id_idx" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoice_client_id_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_num_user_idx" ON "invoices" USING btree ("invoice_number","user_id");--> statement-breakpoint
CREATE INDEX "invoice_item_invoice_id_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "income_user_id_idx" ON "income" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "income_client_id_idx" ON "income" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "income_invoice_id_idx" ON "income" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "expense_user_id_idx" ON "expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "category_user_id_idx" ON "categories" USING btree ("user_id");