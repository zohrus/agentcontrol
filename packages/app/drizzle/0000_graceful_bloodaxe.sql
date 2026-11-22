CREATE TABLE `events` (
	`workspace_id` text NOT NULL,
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`ts` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `session_id`, `seq`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`agent` text NOT NULL,
	`status` text NOT NULL,
	`waiting_reason` text,
	`title` text NOT NULL,
	`repo_path` text NOT NULL,
	`branch` text NOT NULL,
	`base_branch` text NOT NULL,
	`last_seq` integer NOT NULL,
	`created_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`ssh_host` text,
	`last_seen_at` text
);
