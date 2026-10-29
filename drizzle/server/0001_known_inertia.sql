CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`kind` text NOT NULL,
	`target_id` text NOT NULL,
	`space_id` text NOT NULL,
	`role` text NOT NULL,
	`invited_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `invites_email_idx` ON `invites` (`email`);--> statement-breakpoint
CREATE INDEX `invites_target_idx` ON `invites` (`target_id`);--> statement-breakpoint
CREATE TABLE `page_shares` (
	`page_id` text NOT NULL,
	`user_id` text NOT NULL,
	`space_id` text NOT NULL,
	`role` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`page_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `page_shares_user_idx` ON `page_shares` (`user_id`);--> statement-breakpoint
CREATE TABLE `server_records` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`space_id` text,
	`parent_id` text,
	`parent_table` text,
	`type` text,
	`clocks` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `server_records_parent_idx` ON `server_records` (`parent_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`device_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `space_members` (
	`space_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`space_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `space_members_user_idx` ON `space_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `server_ops` ADD `space_id` text;--> statement-breakpoint
CREATE INDEX `server_ops_space_idx` ON `server_ops` (`space_id`,`seq`);