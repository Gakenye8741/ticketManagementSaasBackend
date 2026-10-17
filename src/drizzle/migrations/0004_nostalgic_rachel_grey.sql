CREATE TYPE "public"."ticket_scope" AS ENUM('Organization', 'Platform');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('Open', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed');--> statement-breakpoint
ALTER TYPE "public"."priority" ADD VALUE 'Urgent';--> statement-breakpoint
CREATE TABLE "supportTicketsMedia" (
	"mediaId" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"responseId" integer,
	"uploadedBy" integer NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"fileUrl" text NOT NULL,
	"mimeType" varchar(127) NOT NULL,
	"fileSize" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_media_size_check" CHECK ("supportTicketsMedia"."fileSize" > 0)
);
--> statement-breakpoint
DROP INDEX "response_support_ticket_idx";--> statement-breakpoint
ALTER TABLE "supportTickets" ALTER COLUMN "digitalId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "supportTickets" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "supportTickets" ALTER COLUMN "status" SET DATA TYPE "public"."ticket_status" USING "status"::text::"public"."ticket_status";--> statement-breakpoint
ALTER TABLE "supportTickets" ALTER COLUMN "status" SET DEFAULT 'Open';--> statement-breakpoint
ALTER TABLE "responses" ADD COLUMN "isStaff" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "responses" ADD COLUMN "isInternal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "supportTickets" ADD COLUMN "orgId" integer;--> statement-breakpoint
ALTER TABLE "supportTickets" ADD COLUMN "scope" "ticket_scope" DEFAULT 'Organization' NOT NULL;--> statement-breakpoint
ALTER TABLE "supportTickets" ADD COLUMN "assignedTo" integer;--> statement-breakpoint
ALTER TABLE "supportTickets" ADD COLUMN "escalatedAt" timestamp;--> statement-breakpoint
ALTER TABLE "supportTickets" ADD COLUMN "escalatedBy" integer;--> statement-breakpoint
ALTER TABLE "supportTickets" ADD COLUMN "resolvedAt" timestamp;--> statement-breakpoint
ALTER TABLE "supportTicketsMedia" ADD CONSTRAINT "supportTicketsMedia_ticketId_supportTickets_ticketId_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."supportTickets"("ticketId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supportTicketsMedia" ADD CONSTRAINT "supportTicketsMedia_responseId_responses_responseId_fk" FOREIGN KEY ("responseId") REFERENCES "public"."responses"("responseId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supportTicketsMedia" ADD CONSTRAINT "supportTicketsMedia_uploadedBy_users_digitalId_fk" FOREIGN KEY ("uploadedBy") REFERENCES "public"."users"("digitalId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_media_ticket_idx" ON "supportTicketsMedia" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "ticket_media_response_idx" ON "supportTicketsMedia" USING btree ("responseId");--> statement-breakpoint
ALTER TABLE "supportTickets" ADD CONSTRAINT "supportTickets_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supportTickets" ADD CONSTRAINT "supportTickets_assignedTo_users_digitalId_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supportTickets" ADD CONSTRAINT "supportTickets_escalatedBy_users_digitalId_fk" FOREIGN KEY ("escalatedBy") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "response_ticket_created_idx" ON "responses" USING btree ("ticketId","createdAt");--> statement-breakpoint
CREATE INDEX "support_ticket_org_idx" ON "supportTickets" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "support_ticket_status_idx" ON "supportTickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_ticket_assigned_idx" ON "supportTickets" USING btree ("assignedTo");--> statement-breakpoint
CREATE INDEX "support_ticket_scope_status_idx" ON "supportTickets" USING btree ("scope","status");--> statement-breakpoint
ALTER TABLE "supportTickets" ADD CONSTRAINT "support_ticket_scope_org_check" CHECK ("supportTickets"."scope" = 'Platform' OR "supportTickets"."orgId" IS NOT NULL);--> statement-breakpoint
DROP TYPE "public"."status";