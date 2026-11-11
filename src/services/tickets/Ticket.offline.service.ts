import { eq, and, gt, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import db from "../../drizzle/db";
import { events, scannerLogs, tickets } from "../../drizzle/schema";

// ==========================================
// OFFLINE SCANNING
// ------------------------------------------
// 1. getScannerManifest  → the phone downloads the ticket list before the event
//                          (and small "changes since" updates afterwards)
// 2. processScanBatch    → the phone uploads scans it made while offline
//
// Both are org-scoped exactly like scanTicket: a scanner can only touch events
// that belong to their own organization.
// ==========================================

/** Error that carries an HTTP status so the controller can answer properly */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Raw tokens never leave the server — phones only get this hash. */
const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

/** 404 (not 403) for other orgs' events, so nobody can probe which events exist. */
const assertEventInOrg = async (eventId: number, orgId: number) => {
  const [event] = await db
    .select({ eventId: events.eventId, orgId: events.orgId })
    .from(events)
    .where(eq(events.eventId, eventId));

  if (!event || event.orgId !== orgId) {
    throw new HttpError(404, "Event not found 🚫");
  }
};

// ==========================================
// 1. SCANNER MANIFEST
// ==========================================
export const getScannerManifest = async (
  actorOrgId: number,
  eventId: number,
  since?: string
) => {
  await assertEventInOrg(eventId, actorOrgId);

  // 5s overlap so a change made while this request runs is never missed
  const serverTime = new Date(Date.now() - 5000).toISOString();

  const rows = await db
    .select({
      ticketId: tickets.ticketId,
      ticketToken: tickets.ticketToken,
      attendeeName: tickets.attendeeName,
      ticketTypeName: tickets.ticketTypeName,
      lifecycleStatus: tickets.lifecycleStatus,
      isScanned: tickets.isScanned,
      scannedAt: tickets.scannedAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.eventId, eventId),
        since ? gt(tickets.updatedAt, new Date(since)) : undefined
      )
    );

  return {
    serverTime,
    tickets: rows.map((r) => ({
      tokenHash: sha256(r.ticketToken),
      ticketId: r.ticketId,
      attendeeName: r.attendeeName,
      ticketTypeName: r.ticketTypeName,
      lifecycleStatus: r.lifecycleStatus,
      isScanned: r.isScanned,
      scannedAt: r.scannedAt ? r.scannedAt.toISOString() : null,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
};

// ==========================================
// 2. BATCH SYNC OF OFFLINE SCANS
// ==========================================
export type IncomingScan = {
  clientScanId: string;
  ticketId: number;
  localStatus: "valid" | "duplicate" | "refunded";
  scannedAt: string;
};

export type SyncOutcome =
  | "accepted" // first time this ticket was admitted ✅
  | "duplicate" // someone else admitted it first (two gates while offline) ⚠️
  | "already_logged" // this exact scan was already recorded (safe retry)
  | "rejected" // ticket missing, wrong event, or refunded after the phone last synced
  | "logged"; // phone already said duplicate/refunded — just recorded for the audit trail

const MAX_BATCH = 500;
const LOCAL_STATUSES = ["valid", "duplicate", "refunded"];

export const processScanBatch = async (
  actorDigitalId: number,
  actorOrgId: number,
  body: {
    eventId: number;
    gateName?: string;
    deviceInfo?: string;
    scans: IncomingScan[];
  }
): Promise<{ results: { clientScanId: string; outcome: SyncOutcome }[] }> => {
  const eventId = Number(body?.eventId);
  const scans = body?.scans;

  if (!eventId || Number.isNaN(eventId)) {
    throw new HttpError(400, "Valid event ID is required 🚫");
  }
  if (!Array.isArray(scans) || scans.length === 0 || scans.length > MAX_BATCH) {
    throw new HttpError(400, `Send between 1 and ${MAX_BATCH} scans per batch 🚫`);
  }
  for (const s of scans) {
    if (
      typeof s?.clientScanId !== "string" ||
      !s.clientScanId ||
      s.clientScanId.length > 64 ||
      !Number.isInteger(s.ticketId) ||
      !LOCAL_STATUSES.includes(s.localStatus) ||
      Number.isNaN(Date.parse(s.scannedAt))
    ) {
      throw new HttpError(400, "One or more scans are malformed 🚫");
    }
  }

  await assertEventInOrg(eventId, actorOrgId);

  const gateName = (body.gateName || "Main Gate").slice(0, 100);
  const deviceInfo = `${(body.deviceInfo || "unknown").slice(0, 200)} (offline)`;

  // Retries are safe: any scan we already recorded is skipped.
  const existing = await db
    .select({ id: scannerLogs.clientScanId })
    .from(scannerLogs)
    .where(inArray(scannerLogs.clientScanId, scans.map((s) => s.clientScanId)));
  const seen = new Set(existing.map((e) => e.id));

  const results: { clientScanId: string; outcome: SyncOutcome }[] = [];

  // Oldest scan first, so the earliest physical scan gets "accepted"
  const ordered = [...scans].sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));

  for (const s of ordered) {
    if (seen.has(s.clientScanId)) {
      results.push({ clientScanId: s.clientScanId, outcome: "already_logged" });
      continue;
    }

    // The ticket must exist AND belong to this event.
    const [ticket] = await db
      .select({
        ticketId: tickets.ticketId,
        lifecycleStatus: tickets.lifecycleStatus,
      })
      .from(tickets)
      .where(and(eq(tickets.ticketId, s.ticketId), eq(tickets.eventId, eventId)));

    if (!ticket) {
      results.push({ clientScanId: s.clientScanId, outcome: "rejected" });
      continue;
    }

    // Trust the phone's clock only if it looks sane.
    const claimedAt = new Date(s.scannedAt);
    const scannedAt =
      claimedAt.getTime() > Date.now() + 5 * 60 * 1000 ? new Date() : claimedAt;

    let outcome: SyncOutcome = "logged";
    let status: string = s.localStatus;

    if (s.localStatus === "valid") {
      if (ticket.lifecycleStatus !== "Valid") {
        // refunded / cancelled after the phone last synced
        outcome = "rejected";
        status = "refunded";
      } else {
        // Race-safe: only the first writer can flip isScanned from false to true.
        const [claimed] = await db
          .update(tickets)
          .set({ isScanned: true, scannedAt, updatedAt: new Date() })
          .where(
            and(
              eq(tickets.ticketId, s.ticketId),
              eq(tickets.isScanned, false),
              eq(tickets.lifecycleStatus, "Valid")
            )
          )
          .returning({ ticketId: tickets.ticketId });

        outcome = claimed ? "accepted" : "duplicate";
        status = claimed ? "valid" : "duplicate";
      }
    }

    await db
      .insert(scannerLogs)
      .values({
        orgId: actorOrgId,
        ticketId: s.ticketId,
        eventId,
        scannedBy: actorDigitalId,
        gateName,
        scanStatus: status,
        deviceInfo,
        scannedAt,
        clientScanId: s.clientScanId,
      })
      .onConflictDoNothing();

    results.push({ clientScanId: s.clientScanId, outcome });
  }

  return { results };
};