ALTER TABLE "tickets" ADD COLUMN "bookingItemId" integer;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "ticketTypeId" integer;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "ticketTypeName" varchar(100);--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_bookingItemId_bookingItems_bookingItemId_fk" FOREIGN KEY ("bookingItemId") REFERENCES "public"."bookingItems"("bookingItemId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticketTypeId_ticketTypes_ticketTypeId_fk" FOREIGN KEY ("ticketTypeId") REFERENCES "public"."ticketTypes"("ticketTypeId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_booking_item_idx" ON "tickets" USING btree ("bookingItemId");--> statement-breakpoint
CREATE INDEX "ticket_type_idx" ON "tickets" USING btree ("ticketTypeId");