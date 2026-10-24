CREATE TYPE "public"."refundReasonType" AS ENUM('EventCancelled', 'EventPostponed', 'MaterialChange', 'Other');--> statement-breakpoint
CREATE TYPE "public"."ticket_lifecycle_status" AS ENUM('Valid', 'Refunded', 'Cancelled');--> statement-breakpoint
ALTER TYPE "public"."paymentStatus" ADD VALUE 'PartiallyRefunded';--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "orgId" integer;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "reasonType" "refundReasonType" DEFAULT 'Other' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "ticketIds" jsonb;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "ticketAmount" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "serviceFeeAmount" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "failureReason" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "approvedBy" integer;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "approvedAt" timestamp;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "idempotencyKey" varchar(255);--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "organizerDebit" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "lifecycleStatus" "ticket_lifecycle_status" DEFAULT 'Valid' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "refundedAt" timestamp;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "totalRefunded" numeric(12, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approvedBy_users_digitalId_fk" FOREIGN KEY ("approvedBy") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refund_org_idx" ON "refunds" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "refund_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_idempotencyKey_unique" UNIQUE("idempotencyKey");