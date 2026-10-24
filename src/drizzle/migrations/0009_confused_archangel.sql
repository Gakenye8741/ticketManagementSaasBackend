CREATE TABLE "bookingItems" (
	"bookingItemId" serial PRIMARY KEY NOT NULL,
	"bookingId" integer NOT NULL,
	"ticketTypeId" integer NOT NULL,
	"ticketTypeName" varchar(100) NOT NULL,
	"unitPrice" numeric(10, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"lineTotal" numeric(10, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookingItems" ADD CONSTRAINT "bookingItems_bookingId_bookings_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("bookingId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookingItems" ADD CONSTRAINT "bookingItems_ticketTypeId_ticketTypes_ticketTypeId_fk" FOREIGN KEY ("ticketTypeId") REFERENCES "public"."ticketTypes"("ticketTypeId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_items_booking_idx" ON "bookingItems" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "booking_items_ticket_type_idx" ON "bookingItems" USING btree ("ticketTypeId");