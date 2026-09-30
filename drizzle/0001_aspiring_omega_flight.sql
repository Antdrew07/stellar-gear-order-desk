CREATE TABLE `catalogSettings` (
	`id` int NOT NULL,
	`shippingCents` int NOT NULL DEFAULT 2000,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(120) NOT NULL,
	`unitPriceCents` int NOT NULL,
	`quantity` int NOT NULL,
	`lineTotalCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(40) NOT NULL,
	`status` enum('new','reviewing','confirmed','closed') NOT NULL DEFAULT 'new',
	`customerName` varchar(120) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(48) NOT NULL,
	`address1` varchar(180) NOT NULL,
	`address2` varchar(180),
	`city` varchar(100) NOT NULL,
	`state` varchar(100) NOT NULL,
	`postalCode` varchar(32) NOT NULL,
	`notes` text,
	`subtotalCents` int NOT NULL,
	`shippingCents` int NOT NULL,
	`totalCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`category` varchar(80) NOT NULL,
	`priceCents` int NOT NULL,
	`salePriceCents` int,
	`badge` varchar(24),
	`inStock` boolean NOT NULL DEFAULT true,
	`featured` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
