CREATE TABLE `user_episode_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`episodeId` int NOT NULL,
	`watchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_episode_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_episode_user_episode_unique` UNIQUE(`userId`,`episodeId`)
);
