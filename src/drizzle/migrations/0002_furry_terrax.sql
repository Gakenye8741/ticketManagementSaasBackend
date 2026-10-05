CREATE TYPE "public"."entity_type" AS ENUM('individual', 'corporate');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'in_progress', 'resubmission_requested', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE "organizer_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"digitalId" integer NOT NULL,
	"orgId" integer,
	"entityType" "entity_type" DEFAULT 'individual' NOT NULL,
	"legalFullName" varchar(255) NOT NULL,
	"idFrontUrl" text NOT NULL,
	"idBackUrl" text NOT NULL,
	"selfiePhotos" text[] NOT NULL,
	"businessRegistrationDocUrl" text,
	"taxComplianceCertUrl" text,
	"idFrontRejected" boolean DEFAULT false NOT NULL,
	"idFrontComment" text,
	"idBackRejected" boolean DEFAULT false NOT NULL,
	"idBackComment" text,
	"selfiesRejected" boolean DEFAULT false NOT NULL,
	"selfiesComment" text,
	"businessDocRejected" boolean DEFAULT false NOT NULL,
	"businessDocComment" text,
	"taxCertRejected" boolean DEFAULT false NOT NULL,
	"taxCertComment" text,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"adminComment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizer_verifications" ADD CONSTRAINT "organizer_verifications_digitalId_users_digitalId_fk" FOREIGN KEY ("digitalId") REFERENCES "public"."users"("digitalId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_verifications" ADD CONSTRAINT "organizer_verifications_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizer_verif_user_idx" ON "organizer_verifications" USING btree ("digitalId");--> statement-breakpoint
CREATE INDEX "organizer_verif_org_idx" ON "organizer_verifications" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "organizer_verif_status_idx" ON "organizer_verifications" USING btree ("status");