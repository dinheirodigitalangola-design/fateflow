CREATE TABLE `franchises` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `franchises_id` PRIMARY KEY(`id`),
	CONSTRAINT `franchises_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_library_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_library_user_work_unique` UNIQUE(`userId`,`workId`)
);
--> statement-breakpoint
ALTER TABLE `routes` ADD `franchiseId` int;--> statement-breakpoint
ALTER TABLE `works` ADD `franchiseId` int;