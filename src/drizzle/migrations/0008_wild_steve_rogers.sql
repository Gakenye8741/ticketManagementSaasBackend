ALTER TABLE "bookings" ADD COLUMN "serviceFee" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "totalCharged" numeric(10, 2) DEFAULT '0.00' NOT NULL;