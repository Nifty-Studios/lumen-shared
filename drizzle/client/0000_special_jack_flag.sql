CREATE TABLE `block` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`type` text NOT NULL,
	`properties` text DEFAULT '{}' NOT NULL,
	`content` text DEFAULT '[]' NOT NULL,
	`format` text DEFAULT '{}' NOT NULL,
	`parent_id` text NOT NULL,
	`parent_table` text NOT NULL,
	`collection_id` text,
	`alive` integer DEFAULT true NOT NULL,
	`created_time` integer NOT NULL,
	`last_edited_time` integer NOT NULL,
	`search_text` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `block_parent_idx` ON `block` (`parent_id`);--> statement-breakpoint
CREATE INDEX `block_space_idx` ON `block` (`space_id`,`type`);--> statement-breakpoint
CREATE TABLE `collection` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`name` text DEFAULT '[]' NOT NULL,
	`icon` text,
	`schema` text DEFAULT '{}' NOT NULL,
	`parent_id` text NOT NULL,
	`parent_table` text NOT NULL,
	`alive` integer DEFAULT true NOT NULL,
	`created_time` integer NOT NULL,
	`last_edited_time` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `collection_view` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`format` text DEFAULT '{}' NOT NULL,
	`query` text DEFAULT '{}' NOT NULL,
	`parent_id` text NOT NULL,
	`parent_table` text NOT NULL,
	`alive` integer DEFAULT true NOT NULL,
	`created_time` integer NOT NULL,
	`last_edited_time` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `field_clock` (
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`path_key` text NOT NULL,
	`hlc` text NOT NULL,
	PRIMARY KEY(`table_name`, `record_id`, `path_key`)
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ops` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`path` text NOT NULL,
	`value` text,
	`hlc` text NOT NULL,
	`device_id` text NOT NULL,
	`synced` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_unsynced_idx` ON `ops` (`synced`,`hlc`);--> statement-breakpoint
CREATE INDEX `ops_record_idx` ON `ops` (`table_name`,`record_id`);--> statement-breakpoint
CREATE TABLE `space` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`pages` text DEFAULT '[]' NOT NULL,
	`alive` integer DEFAULT true NOT NULL,
	`created_time` integer NOT NULL,
	`last_edited_time` integer NOT NULL
);
