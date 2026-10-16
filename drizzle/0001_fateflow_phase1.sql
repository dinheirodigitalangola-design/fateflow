CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`actionType` varchar(64) NOT NULL,
	`workId` int,
	`episodeId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workId` int NOT NULL,
	`episodeNumber` int NOT NULL,
	`title` varchar(255),
	`durationMinutes` int,
	`synopsis` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `episodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `route_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routeId` int NOT NULL,
	`workId` int NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`relationType` enum('required','optional') NOT NULL DEFAULT 'required',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `route_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`universe` varchar(64),
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `routes_id` PRIMARY KEY(`id`),
	CONSTRAINT `routes_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`userId` int NOT NULL,
	`selectedRouteId` int,
	`smartRecommendations` boolean NOT NULL DEFAULT true,
	`compactMode` boolean NOT NULL DEFAULT false,
	`language` varchar(16) NOT NULL DEFAULT 'pt-BR',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workId` int NOT NULL,
	`watchedEpisodes` int NOT NULL DEFAULT 0,
	`status` enum('concluido','progresso','proximo','faltam') NOT NULL DEFAULT 'faltam',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `works` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`shortTitle` varchar(128),
	`description` text,
	`year` varchar(32),
	`format` enum('Série','Filme','Especial','OVA') NOT NULL DEFAULT 'Série',
	`universe` varchar(64) NOT NULL DEFAULT 'Fuyuki',
	`arc` varchar(128),
	`orderIndex` int NOT NULL DEFAULT 0,
	`episodeCount` int NOT NULL DEFAULT 1,
	`color` varchar(32),
	`badge` varchar(128),
	`coverUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `works_id` PRIMARY KEY(`id`),
	CONSTRAINT `works_slug_unique` UNIQUE(`slug`)
);
