CREATE TABLE "ledger_asset_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"period" text NOT NULL,
	"value" integer NOT NULL,
	"currency" text NOT NULL,
	"fx_rate" text,
	"base_value" integer NOT NULL,
	"note" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"class" text NOT NULL,
	"currency" text NOT NULL,
	"person_id" text,
	"institution" text,
	"tags" text,
	"notes" text,
	"active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text NOT NULL,
	"period" text,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"group" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_fx_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"rate" text NOT NULL,
	"as_of" text NOT NULL,
	"source" text NOT NULL,
	"fetched_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_income_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source_id" text NOT NULL,
	"period" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"fx_rate" text DEFAULT '1' NOT NULL,
	"base_amount" integer NOT NULL,
	"note" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_income_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"expected_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"cadence" text NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_jar_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"jar_id" text NOT NULL,
	"period" text,
	"date" text,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"fx_rate" text,
	"base_amount" integer NOT NULL,
	"note" text,
	"transaction_id" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_jars" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"monthly_contribution" integer NOT NULL,
	"currency" text NOT NULL,
	"target_amount" integer,
	"linked_recurring_id" text,
	"active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"last_contributed_period" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_people" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_recurring" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"cadence" text NOT NULL,
	"fx_mode" text DEFAULT 'locked' NOT NULL,
	"schedule" text DEFAULT '{}' NOT NULL,
	"jar_id" text,
	"start_date" text NOT NULL,
	"end_date" text,
	"active" integer DEFAULT 1 NOT NULL,
	"last_posted_period" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_settings" (
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"base_currency" text NOT NULL,
	"display_currency" text,
	"month_start_day" integer DEFAULT 1 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	CONSTRAINT "ledger_settings_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text NOT NULL,
	"date" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"fx_mode" text DEFAULT 'base' NOT NULL,
	"fx_rate" text,
	"base_amount" integer NOT NULL,
	"note" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"recurring_id" text,
	"jar_id" text,
	"deleted_at" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_fx_rates_base_quote_as_of_source" ON "ledger_fx_rates" USING btree ("base","quote","as_of","source");