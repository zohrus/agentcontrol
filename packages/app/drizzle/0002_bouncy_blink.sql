CREATE TABLE `config_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`body_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `config_scopes` (
	`item_id` text NOT NULL,
	`scope` text NOT NULL,
	`repo_path` text NOT NULL,
	`enabled` integer NOT NULL,
	PRIMARY KEY(`item_id`, `scope`, `repo_path`)
);
