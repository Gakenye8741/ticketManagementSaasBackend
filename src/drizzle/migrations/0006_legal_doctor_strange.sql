CREATE TABLE "platform_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" varchar(255) NOT NULL,
	"updatedBy" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "serviceFee" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "serviceFeePercent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "totalCharged" numeric(10, 2) DEFAULT '0.00' NOT NULL;