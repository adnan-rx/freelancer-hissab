CREATE TABLE "tax_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_year" varchar(9) NOT NULL,
	"income_type" varchar(50) NOT NULL,
	"rate" numeric(5, 4) NOT NULL,
	"threshold" numeric(14, 2),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
