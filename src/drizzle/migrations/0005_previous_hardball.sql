ALTER TYPE "public"."payoutStatus" ADD VALUE 'Reversed';--> statement-breakpoint
ALTER TABLE "organizer_payout_methods" ADD COLUMN "bankCode" varchar(20);--> statement-breakpoint
ALTER TABLE "organizer_payout_methods" ADD COLUMN "recipientCode" varchar(100);--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "methodId" integer;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "reference" varchar(100);--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "transferCode" varchar(100);--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "failureReason" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_reference_unique" UNIQUE("reference");