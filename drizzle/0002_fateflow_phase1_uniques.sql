ALTER TABLE `episodes` ADD CONSTRAINT `episodes_work_episode_unique` UNIQUE(`workId`,`episodeNumber`);--> statement-breakpoint
ALTER TABLE `route_items` ADD CONSTRAINT `route_items_route_work_unique` UNIQUE(`routeId`,`workId`);--> statement-breakpoint
ALTER TABLE `user_progress` ADD CONSTRAINT `user_progress_user_work_unique` UNIQUE(`userId`,`workId`);