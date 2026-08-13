ALTER TABLE "income" ADD COLUMN "external_id" varchar(255);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "external_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "income_user_external_id_idx" ON "income" USING btree ("user_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_user_external_id_idx" ON "expenses" USING btree ("user_id","external_id");