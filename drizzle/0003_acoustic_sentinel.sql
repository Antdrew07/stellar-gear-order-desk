ALTER TABLE `orders` ADD `paymentStatus` enum('awaiting','received','confirmed') DEFAULT 'awaiting' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `paymentToken` varchar(48);--> statement-breakpoint
ALTER TABLE `orders` ADD `bitcoinAmountSats` bigint;--> statement-breakpoint
ALTER TABLE `orders` ADD `bitcoinRateUsdCents` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `bitcoinAddress` varchar(90);--> statement-breakpoint
ALTER TABLE `orders` ADD `paymentTxid` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `paymentReceivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `paymentConfirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_paymentToken_unique` UNIQUE(`paymentToken`);