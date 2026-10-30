CREATE TABLE `dictionary_words` (
	`user_id` text NOT NULL,
	`word` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `word`)
);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`addressee_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friendships_pair_idx` ON `friendships` (`requester_id`,`addressee_id`);--> statement-breakpoint
CREATE INDEX `friendships_addressee_idx` ON `friendships` (`addressee_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`actor_id` text,
	`page_id` text,
	`space_id` text,
	`friendship_id` text,
	`created_at` integer NOT NULL,
	`read_at` integer
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `invites` ADD `title` text;