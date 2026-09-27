ALTER TABLE "media" DROP CONSTRAINT "media_venueId_venues_venueId_fk";
--> statement-breakpoint
DROP INDEX "media_venue_idx";--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "eventId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "isPrimary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "venueId";