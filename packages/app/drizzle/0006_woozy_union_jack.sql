CREATE TABLE `usage` (
	`workspace_id` text NOT NULL,
	`session_id` text NOT NULL,
	`idx` integer NOT NULL,
	`ts` text NOT NULL,
	`model` text,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cache_read_tokens` integer NOT NULL,
	`cache_write_tokens` integer NOT NULL,
	`cost_usd` real,
	PRIMARY KEY(`workspace_id`, `session_id`, `idx`)
);
