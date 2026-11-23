CREATE TABLE `session_normalisation` (
	`workspace_id` text NOT NULL,
	`session_id` text NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `session_id`)
);
--> statement-breakpoint
INSERT INTO `session_normalisation` (`workspace_id`, `session_id`, `version`)
SELECT DISTINCT `workspace_id`, `session_id`, 0 FROM `events`;
