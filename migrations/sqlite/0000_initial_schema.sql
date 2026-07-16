-- Ledger plugin schema — SQLite dialect. v0.1 scaffold (Task 0).
-- Idempotent (IF NOT EXISTS) — safe to run against an existing store.
-- Mirrors migrations/postgres/0000_initial_schema.sql (hand-authored — no
-- generate step for SQLite, per platform convention).

CREATE TABLE IF NOT EXISTS `ledger_asset_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`period` text NOT NULL,
	`value` integer NOT NULL,
	`currency` text NOT NULL,
	`fx_rate` text,
	`base_value` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`class` text NOT NULL,
	`currency` text NOT NULL,
	`person_id` text,
	`institution` text,
	`tags` text,
	`notes` text,
	`active` integer NOT NULL DEFAULT true,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`period` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`group` text NOT NULL,
	`sort_order` integer NOT NULL DEFAULT 0,
	`archived` integer NOT NULL DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_fx_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`base` text NOT NULL,
	`quote` text NOT NULL,
	`rate` text NOT NULL,
	`as_of` text NOT NULL,
	`source` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_income_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source_id` text NOT NULL,
	`period` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`fx_rate` text NOT NULL DEFAULT '1',
	`base_amount` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_income_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`expected_amount` integer NOT NULL,
	`currency` text NOT NULL,
	`cadence` text NOT NULL,
	`active` integer NOT NULL DEFAULT true,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_jar_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`jar_id` text NOT NULL,
	`period` text,
	`date` text,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`fx_rate` text,
	`base_amount` integer NOT NULL,
	`note` text,
	`transaction_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_jars` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`monthly_contribution` integer NOT NULL,
	`currency` text NOT NULL,
	`target_amount` integer,
	`linked_recurring_id` text,
	`active` integer NOT NULL DEFAULT true,
	`sort_order` integer NOT NULL DEFAULT 0,
	`last_contributed_period` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_people` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_recurring` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`cadence` text NOT NULL,
	`fx_mode` text NOT NULL DEFAULT 'locked',
	`schedule` text NOT NULL DEFAULT '{}',
	`jar_id` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`active` integer NOT NULL DEFAULT true,
	`last_posted_period` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_settings` (
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`base_currency` text NOT NULL,
	`display_currency` text,
	`month_start_day` integer NOT NULL DEFAULT 1,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`fx_mode` text NOT NULL DEFAULT 'base',
	`fx_rate` text,
	`base_amount` integer NOT NULL,
	`note` text,
	`source` text NOT NULL DEFAULT 'manual',
	`recurring_id` text,
	`jar_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ledger_fx_rates_base_quote_as_of_source` ON `ledger_fx_rates` (`base`,`quote`,`as_of`,`source`);
