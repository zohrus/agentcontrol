PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text NOT NULL,
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
	`archived_at` text,
	`turn_running` integer DEFAULT false NOT NULL,
	`pending_permissions_json` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`workspace_id`, `id`)
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "workspace_id", "agent", "status", "waiting_reason", "title", "repo_path", "branch", "base_branch", "last_seq", "created_at", "archived_at") SELECT "id", "workspace_id", "agent", "status", "waiting_reason", "title", "repo_path", "branch", "base_branch", "last_seq", "created_at", "archived_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;