CREATE TABLE `server_ops` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`path` text NOT NULL,
	`value` text,
	`hlc` text NOT NULL,
	`device_id` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `server_ops_id_unique` ON `server_ops` (`id`);--> statement-breakpoint
CREATE INDEX `server_ops_device_idx` ON `server_ops` (`device_id`,`seq`);