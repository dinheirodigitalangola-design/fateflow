CREATE TABLE `user_work_meta` (
	`userId` int NOT NULL,
	`workId` int NOT NULL,
	`rating` int,
	`notes` text,
	`favorite` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_work_meta_user_work_unique` UNIQUE(`userId`,`workId`)
);
