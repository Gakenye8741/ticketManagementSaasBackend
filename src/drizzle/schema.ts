import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  decimal,
  date,
  time,
  pgEnum,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =======================
// ENUMS
// =======================

export const eventCategoryEnum = pgEnum("event_category", [
  "music",
  "conference",
  "workshop",
  "festival",
  "sports",
  "arts_theatre",
  "networking",
  "nightlife",
  "charity",
  "exhibition",
  "religious",
  "food_drink",
  "technology",
  "comedy",
  "other"
]);

export const roleEnum = pgEnum("role", ["user", "admin", "organizer"]);
export const orgRoleEnum = pgEnum("orgRole", ["owner", "admin", "manager","scanner"]);
export const bookingStatusEnum = pgEnum("bookingStatus", ["Pending", "Confirmed", "Cancelled", "Refunded"]);
export const paymentStatusEnum = pgEnum("paymentStatus", ["Pending", "Completed", "Failed", "Paid", "Refunded"]);
export const ticketStatusEnum = pgEnum("status", ["Open", "In Progress", "Resolved", "Closed"]);
export const venueStatusEnum = pgEnum("venueStatus", ["available", "booked"]);
export const eventStatusEnum = pgEnum("eventStatus", ["in_progress", "ended", "cancelled", "upcoming"]);
export const mediaTypeEnum = pgEnum("mediaType", ["image", "video"]);
export const priorityEnum = pgEnum("priority", ["Low", "Medium", "High"]);
export const payoutStatusEnum = pgEnum("payoutStatus", ["Pending", "Processing", "Completed", "Failed"]);
export const transferStatusEnum = pgEnum("transferStatus", ["unassigned", "pending_claim", "transferred"]);
export const notificationTypeEnum = pgEnum("notificationType", [
  "ticket_assigned",
  "ticket_transferred",
  "gate_checkin",
  "booking_confirmation",
  "refund_issued",
  "password_reset",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",                 // Newly submitted, waiting in queue
  "in_progress",             // Admin is actively reviewing
  "resubmission_requested",  // Specific photos/documents need fixes
  "approved",                // Fully verified
  "rejected",                // Failed verification entirely
  "suspended",               // Revoked due to fraud/suspicious activity
]);

// Entity type enum
export const entityTypeEnum = pgEnum("entity_type", ["individual", "corporate"]);

export const notificationChannelEnum = pgEnum("notificationChannel", ["email", "sms", "whatsapp"]);
export const refundStatusEnum = pgEnum("refundStatus", ["Pending", "Processing", "Completed", "Failed", "Rejected"]);

// =======================
// USERS
// =======================

export const users = pgTable("users", {
  digitalId: serial("digitalId").primaryKey(),
  firstName: varchar("firstName", { length: 255 }).notNull(),
  lastName: varchar("lastName", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  confirmationCode: varchar("confirmationCode", { length: 255 }).default(""),
  password: varchar("password", { length: 255 }), // nullable for guest-checkout profiles
  contactPhone: varchar("contactPhone", { length: 20 }).notNull().unique(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Kenya"),
  profileImageUrl: text("profileImageUrl"),
  role: roleEnum("role").notNull().default("user"),
  isActive: boolean("isActive").notNull().default(true),

  // Auth & security fields
  passwordResetToken: varchar("passwordResetToken", { length: 255 }),
  passwordResetExpiresAt: timestamp("passwordResetExpiresAt"),
  failedLoginAttempts: integer("failedLoginAttempts").notNull().default(0),
  lockedUntil: timestamp("lockedUntil"),
  lastLoginAt: timestamp("lastLoginAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    emailIdx: index("user_email_idx").on(table.email),
    phoneIdx: index("user_phone_idx").on(table.contactPhone),
    resetTokenIdx: uniqueIndex("user_reset_token_idx").on(table.passwordResetToken),
  };
});

// =======================
// REFRESH TOKENS
// =======================

export const refreshTokens = pgTable("refresh_tokens", {
  tokenId: serial("tokenId").primaryKey(),
  digitalId: integer("digitalId").references(() => users.digitalId, { onDelete: "cascade" }).notNull(),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull().unique(),
  deviceInfo: varchar("deviceInfo", { length: 255 }),
  ipAddress: varchar("ipAddress", { length: 64 }),
  isRevoked: boolean("isRevoked").notNull().default(false),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("refresh_token_user_idx").on(table.digitalId),
    tokenHashIdx: uniqueIndex("refresh_token_hash_idx").on(table.tokenHash),
  };
});

// organizerVerifications   table

export const organizerVerifications = pgTable("organizer_verifications", {
  id: serial("id").primaryKey(),
  
  // Foreign Keys mapping to your tables
  userId: integer("digitalId")
    .notNull()
    .references(() => users.digitalId, { onDelete: "cascade" }),
    
  orgId: integer("orgId")
    .references(() => organizations.orgId, { onDelete: "cascade" }),

  entityType: entityTypeEnum("entityType").default("individual").notNull(),
  legalFullName: varchar("legalFullName", { length: 255 }).notNull(),

  // 1. Identity Verification (KYC - Cloudinary URLs)
  idFrontUrl: text("idFrontUrl").notNull(),
  idBackUrl: text("idBackUrl").notNull(),
  selfiePhotos: text("selfiePhotos").array().notNull(),

  // 3. Business Details (Required if entityType is 'corporate')
  businessRegistrationDocUrl: text("businessRegistrationDocUrl"),
  taxComplianceCertUrl: text("taxComplianceCertUrl"),

  // =========================================================================
  // GRANULAR FIELD-LEVEL FEEDBACK & REJECTION REASONS
  // =========================================================================
  idFrontRejected: boolean("idFrontRejected").notNull().default(false),
  idFrontComment: text("idFrontComment"), // e.g. "Blurry, retake with better lighting"

  idBackRejected: boolean("idBackRejected").notNull().default(false),
  idBackComment: text("idBackComment"),   // e.g. "Corners cut off, show full ID card"

  selfiesRejected: boolean("selfiesRejected").notNull().default(false),
  selfiesComment: text("selfiesComment"), // e.g. "Live selfie did not match ID face clearly"

  businessDocRejected: boolean("businessDocRejected").notNull().default(false),
  businessDocComment: text("businessDocComment"),

  taxCertRejected: boolean("taxCertRejected").notNull().default(false),
  taxCertComment: text("taxCertComment"),

  // Global Review Status & General Admin Comments
  status: verificationStatusEnum("status").default("pending").notNull(),
  adminComment: text("adminComment"), // Overall application summary or final rejection reason

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    userVerifIdx: index("organizer_verif_user_idx").on(table.userId),
    orgVerifIdx: index("organizer_verif_org_idx").on(table.orgId),
    statusIdx: index("organizer_verif_status_idx").on(table.status),
  };
});

// =======================
// SAAS: ORGANIZATIONS (Multi-Tenancy & Ticket Commissions)
// =======================

export const organizations = pgTable("organizations", {
  orgId: serial("orgId").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  supportEmail: varchar("supportEmail", { length: 255 }),
  supportPhone: varchar("supportPhone", { length: 20 }),
  logoUrl: text("logoUrl"),
  
  // Financial Payout Info (For sending net earnings via M-Pesa)
  payoutPhone: varchar("payoutPhone", { length: 20 }), // M-Pesa number / Till / Paybill for payouts
  payoutType: varchar("payoutType", { length: 50 }).default("mpesa_phone"), // 'mpesa_phone', 'paybill', 'bank'

  // Platform Commission Configuration per Tenant (Pure Commission Model)
  commissionPercentage: decimal("commissionPercentage", { precision: 5, scale: 2 }).notNull().default("5.00"), // e.g. 5.00% cut per ticket
  
  // Status & Verification
  isVerified: boolean("isVerified").notNull().default(false), // Admin verification badge
  isActive: boolean("isActive").notNull().default(true),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    slugIdx: index("org_slug_idx").on(table.slug),
    phoneIdx: index("org_phone_idx").on(table.supportPhone),
  };
});

// =======================
// SAAS: ORGANIZATION MEMBERS (RBAC)
// =======================

export const organizationMembers = pgTable("organization_members", {
  memberId: serial("memberId").primaryKey(),
  orgId: integer("orgId").references(() => organizations.orgId, { onDelete: "cascade" }).notNull(),
  digitalId: integer("digitalId").references(() => users.digitalId, { onDelete: "cascade" }).notNull(),
  orgRole: orgRoleEnum("orgRole").notNull().default("scanner"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    orgUserIdx: uniqueIndex("org_member_org_user_idx").on(table.orgId, table.digitalId),
    orgIdx: index("org_member_org_idx").on(table.orgId),
    userIdx: index("org_member_user_idx").on(table.digitalId),
  };
});

// =======================
// SAAS: EVENT STAFF
// =======================

export const eventStaff = pgTable("event_staff", {
  staffId: serial("staffId").primaryKey(),
  eventId: integer("eventId").references(() => events.eventId, { onDelete: "cascade" }).notNull(),
  digitalId: integer("digitalId").references(() => users.digitalId, { onDelete: "cascade" }).notNull(),
  assignedGate: varchar("assignedGate", { length: 100 }).default("Main Gate"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    eventUserIdx: uniqueIndex("event_staff_event_user_idx").on(table.eventId, table.digitalId),
    eventIdx: index("event_staff_event_idx").on(table.eventId),
  };
});

// =======================
// SAAS: WALLETS
// =======================

export const wallets = pgTable("wallets", {
  walletId: serial("walletId").primaryKey(),
  orgId: integer("orgId").references(() => organizations.orgId, { onDelete: "cascade" }).notNull().unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  pendingBalance: decimal("pendingBalance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalEarned: decimal("totalEarned", { precision: 12, scale: 2 }).notNull().default("0.00"),
  currency: varchar("currency", { length: 10 }).notNull().default("KES"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    orgIdx: index("wallet_org_idx").on(table.orgId),
  };
});

// =======================
// SAAS: PAYOUTS
// =======================

export const payouts = pgTable("payouts", {
  payoutId: serial("payoutId").primaryKey(),
  walletId: integer("walletId").references(() => wallets.walletId, { onDelete: "cascade" }).notNull(),
  orgId: integer("orgId").references(() => organizations.orgId, { onDelete: "cascade" }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  status: payoutStatusEnum("status").notNull().default("Pending"),
  destinationAccount: varchar("destinationAccount", { length: 255 }).notNull(),
  destinationType: varchar("destinationType", { length: 50 }).notNull(),
  transactionReference: varchar("transactionReference", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    orgIdx: index("payout_org_idx").on(table.orgId),
    walletIdx: index("payout_wallet_idx").on(table.walletId),
  };
});

// =======================
// SAAS: SAVED PAYOUT METHODS
// =======================

export const organizerPayoutMethods = pgTable("organizer_payout_methods", {
  methodId: serial("methodId").primaryKey(),
  orgId: integer("orgId").references(() => organizations.orgId, { onDelete: "cascade" }).notNull(),
  accountName: varchar("accountName", { length: 255 }).notNull(),
  accountNumber: varchar("accountNumber", { length: 100 }).notNull(),
  accountType: varchar("accountType", { length: 50 }).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    orgIdx: index("payout_method_org_idx").on(table.orgId),
  };
});

// =======================
// VENUES
// =======================

export const venues = pgTable("venues", {
  venueId: serial("venueId").primaryKey(),
  orgId: integer("orgId").references(() => organizations.orgId, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  capacity: integer("capacity").notNull(),
  status: venueStatusEnum("status").default("available").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    orgIdx: index("venue_org_idx").on(table.orgId),
  };
});

export const events = pgTable("events", {
  eventId: serial("eventId").primaryKey(),
  orgId: integer("orgId").references(() => organizations.orgId, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  venueId: integer("venueId").references(() => venues.venueId, { onDelete: "cascade" }),
  category: eventCategoryEnum("category").default("other").notNull(),
  date: date("date").notNull(),
  time: time("time").notNull(),
  ticketPrice: decimal("ticketPrice", { precision: 10, scale: 2 }).notNull(),
  ticketsTotal: integer("ticketsTotal").notNull(),
  ticketsSold: integer("ticketsSold").default(0),
  status: eventStatusEnum("eventStatus").default("upcoming").notNull(),
  cancellationPolicy: text("cancellationPolicy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    slugIdx: uniqueIndex("event_slug_idx").on(table.slug),
    dateIdx: index("event_date_idx").on(table.date),
    orgIdx: index("event_org_idx").on(table.orgId),
    venueIdx: index("event_venue_idx").on(table.venueId),
    categoryIdx: index("event_category_idx").on(table.category),
  };
});
// =======================
// TICKET TYPES
// =======================

export const ticketTypes = pgTable("ticketTypes", {
  ticketTypeId: serial("ticketTypeId").primaryKey(),
  eventId: integer("eventId").references(() => events.eventId, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  sold: integer("sold").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    eventIdx: index("ticket_type_event_idx").on(table.eventId),
  };
});

// =======================
// SAAS: PROMO CODES & DISCOUNTS
// =======================

export const promoCodes = pgTable("promo_codes", {
  promoId: serial("promoId").primaryKey(),
  orgId: integer("orgId").references(() => organizations.orgId, { onDelete: "cascade" }).notNull(),
  eventId: integer("eventId").references(() => events.eventId, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountType: varchar("discountType", { length: 20 }).notNull(),
  discountValue: decimal("discountValue", { precision: 10, scale: 2 }).notNull(),
  maxUses: integer("maxUses"),
  timesUsed: integer("timesUsed").default(0).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    codeIdx: index("promo_code_idx").on(table.code),
    orgIdx: index("promo_org_idx").on(table.orgId),
    eventIdx: index("promo_event_idx").on(table.eventId),
  };
});

// =======================
// MPESA LOGS
// =======================

export const mpesaLogs = pgTable("mpesa_logs", {
  id: serial("id").primaryKey(),
  checkoutRequestId: text("checkout_request_id"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    checkoutIdx: index("mpesa_checkout_idx").on(table.checkoutRequestId),
  };
});

// =======================
// BOOKINGS
// =======================

export const bookings = pgTable("bookings", {
  bookingId: serial("bookingId").primaryKey(),
  digitalId: integer("digitalId").references(() => users.digitalId, { onDelete: "set null" }),
  guestName: varchar("guestName", { length: 255 }),
  guestEmail: varchar("guestEmail", { length: 255 }),
  guestPhone: varchar("guestPhone", { length: 20 }),
  eventId: integer("eventId").references(() => events.eventId, { onDelete: "cascade" }),
  ticketTypeId: integer("ticketTypeId").references(() => ticketTypes.ticketTypeId),
  ticketTypeName: varchar("ticketTypeName", { length: 100 }),
  quantity: integer("quantity").notNull(),
  isBundle: boolean("isBundle").default(false).notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  bookingStatus: bookingStatusEnum("bookingStatus").default("Pending").notNull(),
  checkoutRequestId: text("checkout_request_id").unique(),
  idempotencyKey: varchar("idempotencyKey", { length: 255 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("booking_user_idx").on(table.digitalId),
    eventIdx: index("booking_event_idx").on(table.eventId),
    checkoutReqIdx: index("booking_checkout_req_idx").on(table.checkoutRequestId),
    idempotencyIdx: index("booking_idempotency_idx").on(table.idempotencyKey),
  };
});

// =======================
// PAYMENTS & COMMISSION RECONCILIATION
// =======================

export const payments = pgTable("payments", {
  paymentId: serial("paymentId").primaryKey(),
  orgId: integer("orgId").references(() => organizations.orgId, { onDelete: "cascade" }),
  bookingId: integer("bookingId").references(() => bookings.bookingId, { onDelete: "cascade" }),
  
  // Optional digitalId to support frictionless guest checkouts
  digitalId: integer("digitalId").references(() => users.digitalId, { onDelete: "set null" }),
  
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platformFee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  netAmount: decimal("netAmount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  paymentStatus: paymentStatusEnum("paymentStatus").default("Pending").notNull(),
  paymentDate: timestamp("paymentDate").defaultNow().notNull(),
  
  // paymentMethod can store "mpesa" or "stripe"
  paymentMethod: varchar("paymentMethod", { length: 100 }), 
  
  // General transaction identifier (e.g., M-Pesa Receipt Number or Stripe Charge ID)
  transactionId: varchar("transactionId", { length: 255 }).unique(),

  // M-Pesa Daraja fields
  checkoutRequestId: varchar("checkoutRequestId", { length: 255 }),
  merchantRequestId: varchar("merchantRequestId", { length: 255 }),
  resultCode: varchar("resultCode", { length: 10 }),
  resultDesc: varchar("resultDesc", { length: 255 }),

  // Stripe specific fields (optional, to easily map webhook events)
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeClientSecret: varchar("stripeClientSecret", { length: 255 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    bookingIdx: index("payment_booking_idx").on(table.bookingId),
    orgIdx: index("payment_org_idx").on(table.orgId),
    checkoutReqIdx: index("payment_checkout_req_idx").on(table.checkoutRequestId),
    stripePaymentIntentIdx: index("payment_stripe_intent_idx").on(table.stripePaymentIntentId),
  };
});

// =======================
// REFUNDS
// =======================

export const refunds = pgTable("refunds", {
  refundId: serial("refundId").primaryKey(),
  paymentId: integer("paymentId").references(() => payments.paymentId, { onDelete: "cascade" }).notNull(),
  bookingId: integer("bookingId").references(() => bookings.bookingId, { onDelete: "cascade" }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  status: refundStatusEnum("status").notNull().default("Pending"),
  initiatedBy: integer("initiatedBy").references(() => users.digitalId, { onDelete: "set null" }),
  transactionReference: varchar("transactionReference", { length: 255 }),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    paymentIdx: index("refund_payment_idx").on(table.paymentId),
    bookingIdx: index("refund_booking_idx").on(table.bookingId),
  };
});

// =======================
// SUPPORT TICKETS
// =======================

export const supportTickets = pgTable("supportTickets", {
  ticketId: serial("ticketId").primaryKey(),
  digitalId: integer("digitalId").references(() => users.digitalId, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").default("Open").notNull(),
  priority: priorityEnum("priority").default("Medium").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("support_ticket_user_idx").on(table.digitalId),
  };
});

// =======================
// MEDIA (Event-Centric)
// =======================

export const media = pgTable("media", {
  mediaId: serial("mediaId").primaryKey(),
  eventId: integer("eventId")
    .references(() => events.eventId, { onDelete: "cascade" })
    .notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  type: mediaTypeEnum("type").notNull(), // 'banner', 'gallery', 'poster'
  isPrimary: boolean("isPrimary").default(false).notNull(), // <-- Great for default cover images
  altText: varchar("altText", { length: 255 }),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    eventIdx: index("media_event_idx").on(table.eventId),
  };
});

// =======================
// RESPONSES
// =======================

export const responses = pgTable("responses", {
  responseId: serial("responseId").primaryKey(),
  ticketId: integer("ticketId").references(() => supportTickets.ticketId, { onDelete: "cascade" }).notNull(),
  digitalId: integer("digitalId").references(() => users.digitalId, { onDelete: "cascade" }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    supportTicketIdx: index("response_support_ticket_idx").on(table.ticketId),
  };
});

// =======================
// TICKETS (Bundle Grouping & Transfer Lifecycle)
// =======================

export const tickets = pgTable("tickets", {
  ticketId: serial("ticketId").primaryKey(),
  digitalId: integer("digitalId").references(() => users.digitalId, { onDelete: "set null" }), // Current holder
  purchaserDigitalId: integer("purchaserDigitalId").references(() => users.digitalId, { onDelete: "set null" }), // Original buyer
  bookingId: integer("bookingId").references(() => bookings.bookingId, { onDelete: "cascade" }).notNull(),
  eventId: integer("eventId").references(() => events.eventId, { onDelete: "cascade" }).notNull(),
  ticketToken: varchar("ticketToken", { length: 255 }).notNull().unique(),
  ticketNumber: varchar("ticketNumber", { length: 50 }),

  // Group bundle allocation
  groupBundleId: varchar("groupBundleId", { length: 100 }),

  isAssigned: boolean("isAssigned").default(false).notNull(),
  attendeeName: varchar("attendeeName", { length: 255 }),
  attendeeEmail: varchar("attendeeEmail", { length: 255 }),
  attendeePhone: varchar("attendeePhone", { length: 20 }),

  // Transfer & claim lifecycle
  transferStatus: transferStatusEnum("transferStatus").default("unassigned").notNull(),
  claimToken: varchar("claimToken", { length: 255 }).unique(),
  claimTokenExpiresAt: timestamp("claimTokenExpiresAt"),
  claimedAt: timestamp("claimedAt"),

  // Gate scanning status
  isScanned: boolean("isScanned").default(false).notNull(),
  scannedAt: timestamp("scannedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    tokenIdx: uniqueIndex("token_idx").on(table.ticketToken),
    claimTokenIdx: uniqueIndex("ticket_claim_token_idx").on(table.claimToken),
    bundleIdx: index("ticket_group_bundle_idx").on(table.groupBundleId),
    bookingIdx: index("ticket_booking_idx").on(table.bookingId),
    eventIdx: index("ticket_event_idx").on(table.eventId),
    attendeeEmailIdx: index("ticket_attendee_email_idx").on(table.attendeeEmail),
    holderIdx: index("ticket_holder_idx").on(table.digitalId),
  };
});

// =======================
// SAAS: GATE SCANNER LOGS
// =======================

export const scannerLogs = pgTable("scanner_logs", {
  logId: serial("logId").primaryKey(),
  orgId: integer("orgId").references(() => organizations.orgId, { onDelete: "cascade" }).notNull(),
  ticketId: integer("ticketId").references(() => tickets.ticketId, { onDelete: "cascade" }).notNull(),
  scannedBy: integer("scannedBy").references(() => users.digitalId, { onDelete: "set null" }),
  eventId: integer("eventId").references(() => events.eventId, { onDelete: "cascade" }).notNull(),
  gateName: varchar("gateName", { length: 100 }).notNull().default("Main Gate"),
  scanStatus: varchar("scanStatus", { length: 50 }).notNull(),
  deviceInfo: varchar("deviceInfo", { length: 255 }),
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
}, (table) => {
  return {
    eventScanIdx: index("scanner_logs_event_idx").on(table.eventId, table.scannedAt),
    ticketIdx: index("scanner_logs_ticket_idx").on(table.ticketId),
    orgIdx: index("scanner_logs_org_idx").on(table.orgId),
  };
});

// =======================
// NOTIFICATIONS AUDIT LOG
// =======================

export const notifications = pgTable("notifications", {
  notificationId: serial("notificationId").primaryKey(),
  ticketId: integer("ticketId").references(() => tickets.ticketId, { onDelete: "cascade" }),
  digitalId: integer("digitalId").references(() => users.digitalId, { onDelete: "set null" }),
  recipientEmail: varchar("recipientEmail", { length: 255 }),
  recipientPhone: varchar("recipientPhone", { length: 20 }),
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  message: text("message").notNull(),
  isSent: boolean("isSent").default(false).notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    ticketIdx: index("notification_ticket_idx").on(table.ticketId),
    userIdx: index("notification_user_idx").on(table.digitalId),
  };
});

// =======================
// SAAS: AUDIT LOGS
// =======================

export const auditLogs = pgTable("audit_logs", {
  auditId: serial("auditId").primaryKey(),
  orgId: integer("orgId").references(() => organizations.orgId, { onDelete: "cascade" }),
  actorDigitalId: integer("actorDigitalId").references(() => users.digitalId, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  targetTable: varchar("targetTable", { length: 100 }),
  targetId: varchar("targetId", { length: 100 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    orgIdx: index("audit_org_idx").on(table.orgId),
    actorIdx: index("audit_actor_idx").on(table.actorDigitalId),
  };
});

// =======================
// RELATIONS
// =======================

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  supportTickets: many(supportTickets),
  tickets: many(tickets),
  purchasedTickets: many(tickets, { relationName: "purchaser" }),
  organizationMembers: many(organizationMembers),
  eventStaffAssignments: many(eventStaff),
  scannerLogs: many(scannerLogs),
  refreshTokens: many(refreshTokens),
  refundsInitiated: many(refunds),
  auditLogs: many(auditLogs),
  verifications: many(organizerVerifications), // Added for user KYC verification records
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.digitalId],
    references: [users.digitalId],
  }),
}));



export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(organizationMembers),
  venues: many(venues),
  events: many(events),
  payments: many(payments),
  wallet: one(wallets, {
    fields: [organizations.orgId],
    references: [wallets.orgId],
  }),
  payouts: many(payouts),
  payoutMethods: many(organizerPayoutMethods),
  promoCodes: many(promoCodes),
  scannerLogs: many(scannerLogs),
  auditLogs: many(auditLogs),
  verifications: many(organizerVerifications), // Added for corporate verification records
}));

export const organizerVerificationsRelations = relations(organizerVerifications, ({ one }) => ({
  user: one(users, {
    fields: [organizerVerifications.userId],
    references: [users.digitalId],
  }),
  organization: one(organizations, {
    fields: [organizerVerifications.orgId],
    references: [organizations.orgId],
  }),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.orgId],
    references: [organizations.orgId],
  }),
  user: one(users, {
    fields: [organizationMembers.digitalId],
    references: [users.digitalId],
  }),
}));

export const eventStaffRelations = relations(eventStaff, ({ one }) => ({
  event: one(events, {
    fields: [eventStaff.eventId],
    references: [events.eventId],
  }),
  user: one(users, {
    fields: [eventStaff.digitalId],
    references: [users.digitalId],
  }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [wallets.orgId],
    references: [organizations.orgId],
  }),
  payouts: many(payouts),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  wallet: one(wallets, {
    fields: [payouts.walletId],
    references: [wallets.walletId],
  }),
  organization: one(organizations, {
    fields: [payouts.orgId],
    references: [organizations.orgId],
  }),
}));

export const organizerPayoutMethodsRelations = relations(organizerPayoutMethods, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizerPayoutMethods.orgId],
    references: [organizations.orgId],
  }),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [venues.orgId],
    references: [organizations.orgId],
  }),
  events: many(events),
  media: many(media),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [events.orgId],
    references: [organizations.orgId],
  }),
  venue: one(venues, {
    fields: [events.venueId],
    references: [venues.venueId],
  }),
  bookings: many(bookings),
  ticketTypes: many(ticketTypes),
  media: many(media),
  tickets: many(tickets),
  promoCodes: many(promoCodes),
  scannerLogs: many(scannerLogs),
  staff: many(eventStaff),
}));

export const ticketTypesRelations = relations(ticketTypes, ({ one }) => ({
  event: one(events, {
    fields: [ticketTypes.eventId],
    references: [events.eventId],
  }),
}));

export const promoCodesRelations = relations(promoCodes, ({ one }) => ({
  organization: one(organizations, {
    fields: [promoCodes.orgId],
    references: [organizations.orgId],
  }),
  event: one(events, {
    fields: [promoCodes.eventId],
    references: [events.eventId],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  user: one(users, {
    fields: [bookings.digitalId],
    references: [users.digitalId],
  }),
  event: one(events, {
    fields: [bookings.eventId],
    references: [events.eventId],
  }),
  ticketType: one(ticketTypes, {
    fields: [bookings.ticketTypeId],
    references: [ticketTypes.ticketTypeId],
  }),
  payments: many(payments),
  tickets: many(tickets),
  refunds: many(refunds),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [payments.orgId],
    references: [organizations.orgId],
  }),
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.bookingId],
  }),
  user: one(users, {
    fields: [payments.digitalId],
    references: [users.digitalId],
  }),
  refunds: many(refunds),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, {
    fields: [refunds.paymentId],
    references: [payments.paymentId],
  }),
  booking: one(bookings, {
    fields: [refunds.bookingId],
    references: [bookings.bookingId],
  }),
  initiator: one(users, {
    fields: [refunds.initiatedBy],
    references: [users.digitalId],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  user: one(users, {
    fields: [supportTickets.digitalId],
    references: [users.digitalId],
  }),
  responses: many(responses),
}));

// =======================
// MEDIA RELATIONS
// =======================

export const mediaRelations = relations(media, ({ one }) => ({
  event: one(events, {
    fields: [media.eventId],
    references: [events.eventId],
  }),
}));

export const responsesRelations = relations(responses, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [responses.ticketId],
    references: [supportTickets.ticketId],
  }),
  user: one(users, {
    fields: [responses.digitalId],
    references: [users.digitalId],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [tickets.bookingId],
    references: [bookings.bookingId],
  }),
  event: one(events, {
    fields: [tickets.eventId],
    references: [events.eventId],
  }),
  holder: one(users, {
    fields: [tickets.digitalId],
    references: [users.digitalId],
  }),
  purchaser: one(users, {
    fields: [tickets.purchaserDigitalId],
    references: [users.digitalId],
    relationName: "purchaser",
  }),
  scannerLogs: many(scannerLogs),
  notifications: many(notifications),
}));

export const scannerLogsRelations = relations(scannerLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [scannerLogs.orgId],
    references: [organizations.orgId],
  }),
  ticket: one(tickets, {
    fields: [scannerLogs.ticketId],
    references: [tickets.ticketId],
  }),
  attendant: one(users, {
    fields: [scannerLogs.scannedBy],
    references: [users.digitalId],
  }),
  event: one(events, {
    fields: [scannerLogs.eventId],
    references: [events.eventId],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  ticket: one(tickets, {
    fields: [notifications.ticketId],
    references: [tickets.ticketId],
  }),
  user: one(users, {
    fields: [notifications.digitalId],
    references: [users.digitalId],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.orgId],
  }),
  actor: one(users, {
    fields: [auditLogs.actorDigitalId],
    references: [users.digitalId],
  }),
}));

// =======================
// TYPES (INFER TYPES)
// =======================

export type TSelectUser = typeof users.$inferSelect;
export type TInsertUser = typeof users.$inferInsert;

export type TSelectRefreshToken = typeof refreshTokens.$inferSelect;
export type TInsertRefreshToken = typeof refreshTokens.$inferInsert;

export type TSelectOrg = typeof organizations.$inferSelect;
export type TInsertOrg = typeof organizations.$inferInsert;

export type TSelectOrgMember = typeof organizationMembers.$inferSelect;
export type TInsertOrgMember = typeof organizationMembers.$inferInsert;

export type TSelectEventStaff = typeof eventStaff.$inferSelect;
export type TInsertEventStaff = typeof eventStaff.$inferInsert;

export type TSelectWallet = typeof wallets.$inferSelect;
export type TInsertWallet = typeof wallets.$inferInsert;

export type TSelectPayout = typeof payouts.$inferSelect;
export type TInsertPayout = typeof payouts.$inferInsert;

export type TSelectPayoutMethod = typeof organizerPayoutMethods.$inferSelect;
export type TInsertPayoutMethod = typeof organizerPayoutMethods.$inferInsert;

export type TSelectVenue = typeof venues.$inferSelect;
export type TInsertVenue = typeof venues.$inferInsert;

export type TSelectEvent = typeof events.$inferSelect;
export type TInsertEvent = typeof events.$inferInsert;

export type TSelectTicketType = typeof ticketTypes.$inferSelect;
export type TInsertTicketType = typeof ticketTypes.$inferInsert;

export type TSelectPromoCode = typeof promoCodes.$inferSelect;
export type TInsertPromoCode = typeof promoCodes.$inferInsert;

export type TSelectBooking = typeof bookings.$inferSelect;
export type TInsertBooking = typeof bookings.$inferInsert;

export type TSelectTicket = typeof tickets.$inferSelect;
export type TInsertTicket = typeof tickets.$inferInsert;

export type TSelectScannerLog = typeof scannerLogs.$inferSelect;
export type TInsertScannerLog = typeof scannerLogs.$inferInsert;

export type TSelectPayment = typeof payments.$inferSelect;
export type TInsertPayment = typeof payments.$inferInsert;

export type TSelectRefund = typeof refunds.$inferSelect;
export type TInsertRefund = typeof refunds.$inferInsert;

export type TSelectSupportTicket = typeof supportTickets.$inferSelect;
export type TInsertSupportTicket = typeof supportTickets.$inferInsert;

export type TSelectMedia = typeof media.$inferSelect;
export type TInsertMedia = typeof media.$inferInsert;

export type TSelectResponse = typeof responses.$inferSelect;
export type TInsertResponse = typeof responses.$inferInsert;

export type TSelectNotification = typeof notifications.$inferSelect;
export type TInsertNotification = typeof notifications.$inferInsert;

export type TSelectAuditLog = typeof auditLogs.$inferSelect;
export type TInsertAuditLog = typeof auditLogs.$inferInsert;

export type TSelectOrganizerVerification = typeof organizerVerifications.$inferSelect;
export type TInsertOrganizerVerification = typeof organizerVerifications.$inferInsert;