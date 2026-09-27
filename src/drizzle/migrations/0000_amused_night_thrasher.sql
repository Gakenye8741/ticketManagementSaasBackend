CREATE TYPE "public"."bookingStatus" AS ENUM('Pending', 'Confirmed', 'Cancelled', 'Refunded');--> statement-breakpoint
CREATE TYPE "public"."event_category" AS ENUM('music', 'conference', 'workshop', 'festival', 'sports', 'arts_theatre', 'networking', 'nightlife', 'charity', 'exhibition', 'religious', 'food_drink', 'technology', 'comedy', 'other');--> statement-breakpoint
CREATE TYPE "public"."eventStatus" AS ENUM('in_progress', 'ended', 'cancelled', 'upcoming');--> statement-breakpoint
CREATE TYPE "public"."mediaType" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."notificationChannel" AS ENUM('email', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notificationType" AS ENUM('ticket_assigned', 'ticket_transferred', 'gate_checkin', 'booking_confirmation', 'refund_issued', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."orgRole" AS ENUM('owner', 'admin', 'manager', 'scanner');--> statement-breakpoint
CREATE TYPE "public"."paymentStatus" AS ENUM('Pending', 'Completed', 'Failed', 'Paid', 'Refunded');--> statement-breakpoint
CREATE TYPE "public"."payoutStatus" AS ENUM('Pending', 'Processing', 'Completed', 'Failed');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('Low', 'Medium', 'High');--> statement-breakpoint
CREATE TYPE "public"."refundStatus" AS ENUM('Pending', 'Processing', 'Completed', 'Failed', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin', 'organizer');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('Open', 'In Progress', 'Resolved', 'Closed');--> statement-breakpoint
CREATE TYPE "public"."transferStatus" AS ENUM('unassigned', 'pending_claim', 'transferred');--> statement-breakpoint
CREATE TYPE "public"."venueStatus" AS ENUM('available', 'booked');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"auditId" serial PRIMARY KEY NOT NULL,
	"orgId" integer,
	"actorDigitalId" integer,
	"action" varchar(100) NOT NULL,
	"targetTable" varchar(100),
	"targetId" varchar(100),
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"bookingId" serial PRIMARY KEY NOT NULL,
	"digitalId" integer,
	"guestName" varchar(255),
	"guestEmail" varchar(255),
	"guestPhone" varchar(20),
	"eventId" integer,
	"ticketTypeId" integer,
	"ticketTypeName" varchar(100),
	"quantity" integer NOT NULL,
	"isBundle" boolean DEFAULT false NOT NULL,
	"totalAmount" numeric(10, 2) NOT NULL,
	"bookingStatus" "bookingStatus" DEFAULT 'Pending' NOT NULL,
	"checkout_request_id" text,
	"idempotencyKey" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_checkout_request_id_unique" UNIQUE("checkout_request_id"),
	CONSTRAINT "bookings_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "event_staff" (
	"staffId" serial PRIMARY KEY NOT NULL,
	"eventId" integer NOT NULL,
	"digitalId" integer NOT NULL,
	"assignedGate" varchar(100) DEFAULT 'Main Gate',
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"eventId" serial PRIMARY KEY NOT NULL,
	"orgId" integer,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"venueId" integer,
	"category" "event_category" DEFAULT 'other' NOT NULL,
	"date" date NOT NULL,
	"time" time NOT NULL,
	"ticketPrice" numeric(10, 2) NOT NULL,
	"ticketsTotal" integer NOT NULL,
	"ticketsSold" integer DEFAULT 0,
	"eventStatus" "eventStatus" DEFAULT 'upcoming' NOT NULL,
	"cancellationPolicy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"mediaId" serial PRIMARY KEY NOT NULL,
	"eventId" integer,
	"venueId" integer,
	"url" varchar(500) NOT NULL,
	"type" "mediaType" NOT NULL,
	"altText" varchar(255),
	"uploadedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mpesa_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"checkout_request_id" text,
	"raw_response" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"notificationId" serial PRIMARY KEY NOT NULL,
	"ticketId" integer,
	"digitalId" integer,
	"recipientEmail" varchar(255),
	"recipientPhone" varchar(20),
	"type" "notificationType" NOT NULL,
	"channel" "notificationChannel" NOT NULL,
	"message" text NOT NULL,
	"isSent" boolean DEFAULT false NOT NULL,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"memberId" serial PRIMARY KEY NOT NULL,
	"orgId" integer NOT NULL,
	"digitalId" integer NOT NULL,
	"orgRole" "orgRole" DEFAULT 'scanner' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"orgId" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"supportEmail" varchar(255),
	"supportPhone" varchar(20),
	"logoUrl" text,
	"payoutPhone" varchar(20),
	"payoutType" varchar(50) DEFAULT 'mpesa_phone',
	"commissionPercentage" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organizer_payout_methods" (
	"methodId" serial PRIMARY KEY NOT NULL,
	"orgId" integer NOT NULL,
	"accountName" varchar(255) NOT NULL,
	"accountNumber" varchar(100) NOT NULL,
	"accountType" varchar(50) NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"paymentId" serial PRIMARY KEY NOT NULL,
	"orgId" integer,
	"bookingId" integer,
	"digitalId" integer,
	"amount" numeric(10, 2) NOT NULL,
	"platformFee" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"netAmount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"paymentStatus" "paymentStatus" DEFAULT 'Pending' NOT NULL,
	"paymentDate" timestamp DEFAULT now() NOT NULL,
	"paymentMethod" varchar(100),
	"transactionId" varchar(255),
	"checkoutRequestId" varchar(255),
	"merchantRequestId" varchar(255),
	"resultCode" varchar(10),
	"resultDesc" varchar(255),
	"stripePaymentIntentId" varchar(255),
	"stripeClientSecret" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_transactionId_unique" UNIQUE("transactionId")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"payoutId" serial PRIMARY KEY NOT NULL,
	"walletId" integer NOT NULL,
	"orgId" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"fee" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"status" "payoutStatus" DEFAULT 'Pending' NOT NULL,
	"destinationAccount" varchar(255) NOT NULL,
	"destinationType" varchar(50) NOT NULL,
	"transactionReference" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"promoId" serial PRIMARY KEY NOT NULL,
	"orgId" integer NOT NULL,
	"eventId" integer,
	"code" varchar(50) NOT NULL,
	"discountType" varchar(20) NOT NULL,
	"discountValue" numeric(10, 2) NOT NULL,
	"maxUses" integer,
	"timesUsed" integer DEFAULT 0 NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"tokenId" serial PRIMARY KEY NOT NULL,
	"digitalId" integer NOT NULL,
	"tokenHash" varchar(255) NOT NULL,
	"deviceInfo" varchar(255),
	"ipAddress" varchar(64),
	"isRevoked" boolean DEFAULT false NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"refundId" serial PRIMARY KEY NOT NULL,
	"paymentId" integer NOT NULL,
	"bookingId" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"reason" text,
	"status" "refundStatus" DEFAULT 'Pending' NOT NULL,
	"initiatedBy" integer,
	"transactionReference" varchar(255),
	"processedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"responseId" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"digitalId" integer NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scanner_logs" (
	"logId" serial PRIMARY KEY NOT NULL,
	"orgId" integer NOT NULL,
	"ticketId" integer NOT NULL,
	"scannedBy" integer,
	"eventId" integer NOT NULL,
	"gateName" varchar(100) DEFAULT 'Main Gate' NOT NULL,
	"scanStatus" varchar(50) NOT NULL,
	"deviceInfo" varchar(255),
	"scannedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supportTickets" (
	"ticketId" serial PRIMARY KEY NOT NULL,
	"digitalId" integer,
	"subject" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" "status" DEFAULT 'Open' NOT NULL,
	"priority" "priority" DEFAULT 'Medium' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketTypes" (
	"ticketTypeId" serial PRIMARY KEY NOT NULL,
	"eventId" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"sold" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"ticketId" serial PRIMARY KEY NOT NULL,
	"digitalId" integer,
	"purchaserDigitalId" integer,
	"bookingId" integer NOT NULL,
	"eventId" integer NOT NULL,
	"ticketToken" varchar(255) NOT NULL,
	"ticketNumber" varchar(50),
	"groupBundleId" varchar(100),
	"isAssigned" boolean DEFAULT false NOT NULL,
	"attendeeName" varchar(255),
	"attendeeEmail" varchar(255),
	"attendeePhone" varchar(20),
	"transferStatus" "transferStatus" DEFAULT 'unassigned' NOT NULL,
	"claimToken" varchar(255),
	"claimTokenExpiresAt" timestamp,
	"claimedAt" timestamp,
	"isScanned" boolean DEFAULT false NOT NULL,
	"scannedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_ticketToken_unique" UNIQUE("ticketToken"),
	CONSTRAINT "tickets_claimToken_unique" UNIQUE("claimToken")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"digitalId" serial PRIMARY KEY NOT NULL,
	"firstName" varchar(255) NOT NULL,
	"lastName" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"confirmationCode" varchar(255) DEFAULT '',
	"password" varchar(255),
	"contactPhone" varchar(20) NOT NULL,
	"address" text,
	"city" varchar(100),
	"country" varchar(100) DEFAULT 'Kenya',
	"profileImageUrl" text,
	"role" "role" DEFAULT 'user' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"passwordResetToken" varchar(255),
	"passwordResetExpiresAt" timestamp,
	"failedLoginAttempts" integer DEFAULT 0 NOT NULL,
	"lockedUntil" timestamp,
	"lastLoginAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_contactPhone_unique" UNIQUE("contactPhone")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"venueId" serial PRIMARY KEY NOT NULL,
	"orgId" integer,
	"name" varchar(255) NOT NULL,
	"address" text NOT NULL,
	"capacity" integer NOT NULL,
	"status" "venueStatus" DEFAULT 'available' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"walletId" serial PRIMARY KEY NOT NULL,
	"orgId" integer NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"pendingBalance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"totalEarned" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(10) DEFAULT 'KES' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_orgId_unique" UNIQUE("orgId")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorDigitalId_users_digitalId_fk" FOREIGN KEY ("actorDigitalId") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_digitalId_users_digitalId_fk" FOREIGN KEY ("digitalId") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ticketTypeId_ticketTypes_ticketTypeId_fk" FOREIGN KEY ("ticketTypeId") REFERENCES "public"."ticketTypes"("ticketTypeId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_digitalId_users_digitalId_fk" FOREIGN KEY ("digitalId") REFERENCES "public"."users"("digitalId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venueId_venues_venueId_fk" FOREIGN KEY ("venueId") REFERENCES "public"."venues"("venueId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_venueId_venues_venueId_fk" FOREIGN KEY ("venueId") REFERENCES "public"."venues"("venueId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticketId_tickets_ticketId_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("ticketId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_digitalId_users_digitalId_fk" FOREIGN KEY ("digitalId") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_digitalId_users_digitalId_fk" FOREIGN KEY ("digitalId") REFERENCES "public"."users"("digitalId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_payout_methods" ADD CONSTRAINT "organizer_payout_methods_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_bookings_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("bookingId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_digitalId_users_digitalId_fk" FOREIGN KEY ("digitalId") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_walletId_wallets_walletId_fk" FOREIGN KEY ("walletId") REFERENCES "public"."wallets"("walletId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_digitalId_users_digitalId_fk" FOREIGN KEY ("digitalId") REFERENCES "public"."users"("digitalId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_payments_paymentId_fk" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("paymentId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_bookingId_bookings_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("bookingId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiatedBy_users_digitalId_fk" FOREIGN KEY ("initiatedBy") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_ticketId_supportTickets_ticketId_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."supportTickets"("ticketId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_digitalId_users_digitalId_fk" FOREIGN KEY ("digitalId") REFERENCES "public"."users"("digitalId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_logs" ADD CONSTRAINT "scanner_logs_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_logs" ADD CONSTRAINT "scanner_logs_ticketId_tickets_ticketId_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("ticketId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_logs" ADD CONSTRAINT "scanner_logs_scannedBy_users_digitalId_fk" FOREIGN KEY ("scannedBy") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_logs" ADD CONSTRAINT "scanner_logs_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supportTickets" ADD CONSTRAINT "supportTickets_digitalId_users_digitalId_fk" FOREIGN KEY ("digitalId") REFERENCES "public"."users"("digitalId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketTypes" ADD CONSTRAINT "ticketTypes_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_digitalId_users_digitalId_fk" FOREIGN KEY ("digitalId") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_purchaserDigitalId_users_digitalId_fk" FOREIGN KEY ("purchaserDigitalId") REFERENCES "public"."users"("digitalId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_bookingId_bookings_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("bookingId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_orgId_organizations_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("orgId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_logs" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actorDigitalId");--> statement-breakpoint
CREATE INDEX "booking_user_idx" ON "bookings" USING btree ("digitalId");--> statement-breakpoint
CREATE INDEX "booking_event_idx" ON "bookings" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "booking_checkout_req_idx" ON "bookings" USING btree ("checkout_request_id");--> statement-breakpoint
CREATE INDEX "booking_idempotency_idx" ON "bookings" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE UNIQUE INDEX "event_staff_event_user_idx" ON "event_staff" USING btree ("eventId","digitalId");--> statement-breakpoint
CREATE INDEX "event_staff_event_idx" ON "event_staff" USING btree ("eventId");--> statement-breakpoint
CREATE UNIQUE INDEX "event_slug_idx" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "event_date_idx" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "event_org_idx" ON "events" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "event_venue_idx" ON "events" USING btree ("venueId");--> statement-breakpoint
CREATE INDEX "event_category_idx" ON "events" USING btree ("category");--> statement-breakpoint
CREATE INDEX "media_event_idx" ON "media" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "media_venue_idx" ON "media" USING btree ("venueId");--> statement-breakpoint
CREATE INDEX "mpesa_checkout_idx" ON "mpesa_logs" USING btree ("checkout_request_id");--> statement-breakpoint
CREATE INDEX "notification_ticket_idx" ON "notifications" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notifications" USING btree ("digitalId");--> statement-breakpoint
CREATE UNIQUE INDEX "org_member_org_user_idx" ON "organization_members" USING btree ("orgId","digitalId");--> statement-breakpoint
CREATE INDEX "org_member_org_idx" ON "organization_members" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "org_member_user_idx" ON "organization_members" USING btree ("digitalId");--> statement-breakpoint
CREATE INDEX "org_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "org_phone_idx" ON "organizations" USING btree ("supportPhone");--> statement-breakpoint
CREATE INDEX "payout_method_org_idx" ON "organizer_payout_methods" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "payment_booking_idx" ON "payments" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "payment_org_idx" ON "payments" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "payment_checkout_req_idx" ON "payments" USING btree ("checkoutRequestId");--> statement-breakpoint
CREATE INDEX "payment_stripe_intent_idx" ON "payments" USING btree ("stripePaymentIntentId");--> statement-breakpoint
CREATE INDEX "payout_org_idx" ON "payouts" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "payout_wallet_idx" ON "payouts" USING btree ("walletId");--> statement-breakpoint
CREATE INDEX "promo_code_idx" ON "promo_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "promo_org_idx" ON "promo_codes" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "promo_event_idx" ON "promo_codes" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "refresh_token_user_idx" ON "refresh_tokens" USING btree ("digitalId");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_token_hash_idx" ON "refresh_tokens" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "refund_payment_idx" ON "refunds" USING btree ("paymentId");--> statement-breakpoint
CREATE INDEX "refund_booking_idx" ON "refunds" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "response_support_ticket_idx" ON "responses" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "scanner_logs_event_idx" ON "scanner_logs" USING btree ("eventId","scannedAt");--> statement-breakpoint
CREATE INDEX "scanner_logs_ticket_idx" ON "scanner_logs" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "scanner_logs_org_idx" ON "scanner_logs" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "support_ticket_user_idx" ON "supportTickets" USING btree ("digitalId");--> statement-breakpoint
CREATE INDEX "ticket_type_event_idx" ON "ticketTypes" USING btree ("eventId");--> statement-breakpoint
CREATE UNIQUE INDEX "token_idx" ON "tickets" USING btree ("ticketToken");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_claim_token_idx" ON "tickets" USING btree ("claimToken");--> statement-breakpoint
CREATE INDEX "ticket_group_bundle_idx" ON "tickets" USING btree ("groupBundleId");--> statement-breakpoint
CREATE INDEX "ticket_booking_idx" ON "tickets" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "ticket_event_idx" ON "tickets" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "ticket_attendee_email_idx" ON "tickets" USING btree ("attendeeEmail");--> statement-breakpoint
CREATE INDEX "ticket_holder_idx" ON "tickets" USING btree ("digitalId");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_phone_idx" ON "users" USING btree ("contactPhone");--> statement-breakpoint
CREATE UNIQUE INDEX "user_reset_token_idx" ON "users" USING btree ("passwordResetToken");--> statement-breakpoint
CREATE INDEX "venue_org_idx" ON "venues" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "wallet_org_idx" ON "wallets" USING btree ("orgId");