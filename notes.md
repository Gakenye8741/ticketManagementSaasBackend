# TicketStream & ElimuCloud Backend Architecture Blueprint
*Comprehensive production-grade system design, middleware pipeline, cron workflows, security hardenings, and high-performance scaling configurations.*

---

## 📑 Table of Contents
1. [Database Schema Architecture](#1-database-schema-architecture)
2. [Express Middleware Suite](#2-express-middleware-suite)
3. [Automated Background Cron Jobs](#3-automated-background-cron-jobs)
4. [Security Measures & Threat Mitigation](#4-security-measures--threat-mitigation)
5. [High-Performance Scaling & Gate Optimization](#5-high-performance-scaling--gate-optimization)
6. [Server Deployment Blueprint (`app.ts`)](#6-server-deployment-blueprint-appts)

---

## 1. Database Schema Architecture
Built for PostgreSQL using Drizzle ORM, optimized around `digitalId` for users, multi-tenant organization isolation, and granular operational metrics:
* **Core & Identity:** `users` (tracked via `digitalId`), `organizations`, `organization_members` (enforcing Role-Based Access Control such as `owner`, `admin`, `scanner`).
* **Events & Ticketing:** `venues`, `events`, `ticketTypes`, `bookings`, and `tickets` (featuring `groupBundleId` for multi-ticket group splits like "Group of 5", alongside individual attendee metadata for unique QR generation).
* **Financials & SaaS:** `wallets`, `payouts`, `organizer_payout_methods`, `payments` (with platform fee tracking), `pricing_rules`, `promo_codes`, and `ambassadors`.
* **Operations & Logs:** `check_in_metrics` (tracking live gate congestion, peak scan velocity per minute), `scanner_logs`, `waitlists`, `notifications`, `user_device_tokens`, and global `newsletters`.

---

## 2. Express Middleware Suite
Essential interceptors and guards mounted on your server pipeline:
* **Body Parsers & Compression:** `express.json()` and `express.urlencoded()` for payload processing, plus `compression()` (Gzip/Brotli) to speed up API responses.
* **Security Headers & CORS:** `helmet()` for hardened HTTP headers and `cors()` restricted strictly to your production domains (`gakenye-ndiritu.co.ke`).
* **Rate Limiting (`express-rate-limit`):** Protects sensitive routes such as user authentication (brute-force defense) and M-Pesa STK push triggers (billing spam prevention).
* **Logging & Validation:** Request loggers (`morgan` / `pino-http`) for traffic monitoring and `zod` for strict payload/query parameter validation.
* **Idempotency Middleware:** Prevents duplicate processing of payment retries and webhook callbacks.
* **Custom Context Guards:** `verifyJwt` (injects `digitalId` and role) and `verifyOrgAccess` (ensures tenant isolation so gate scanners only access assigned event gates).

---

## 3. Automated Background Cron Jobs
Server-side workers running on regular intervals to automate platform operations:
* **Expired Checkout & Inventory Release:** Runs every 1–5 minutes to release reserved ticket stock back to the event pool if an M-Pesa transaction or booking times out.
* **Waitlist Expiration & Auto-Offer:** Rotates and expires unclaimed ticket slots, automatically offering them to the next user in line.
* **Event Status Transition:** Automatically flips event states (`upcoming` $\rightarrow$ `in_progress` $\rightarrow$ `ended`) based on current timestamps.
* **Event Reminder Dispatcher:** Fires automated SMS/email alerts with QR code pass links right before an event starts.
* **Newsletter Dispatcher:** Batches and sends out platform-wide scheduled announcements from the app owner.

---

## 4. Security Measures & Threat Mitigation
* **HMAC / Cryptographic Token Signing:** Prevents QR code tampering or token spoofing by embedding signed tokens within tickets.
* **Check-In Replay Defense:** Hardens the `/api/v1/tickets/scan` endpoint to instantly catch `isScanned: true` flags, returning an immediate alert if a ticket is presented twice.
* **Strict Authentication Limits:** Limits login/registration to 5 requests per 15 minutes per IP address to block credential stuffing.
* **Environment Isolation:** Keeps all Daraja API consumer secrets, database connection strings, and JWT secrets safely locked inside environment variables (`.env`).

---

## 5. High-Performance Scaling & Gate Optimization
Designed to handle extreme traffic spikes, especially during peak entry rushes (1,000+ users/day):
* **Load Balancing & Process Clustering:**
  * **Nginx Reverse Proxy:** Routes incoming requests smoothly across backend worker instances.
  * **PM2 Cluster Mode (`-i max`):** Spawns a Node.js worker process for every CPU core on your VPS to maximize hardware utilization.
  * **Connection Pooling:** Configures the PostgreSQL `pg` pool (`max: 20` to `50`) to handle concurrent database read/writes cleanly.
* **Gate Scanning Optimization:**
  * **Local / Offline Token Caching:** Cache valid ticket tokens locally on scanner mobile apps (Expo SQLite/MMKV) before the event. This allows instant offline QR verification during massive gate queues, syncing logs back to the server in the background once congestion clears.

---

## 6. Server Deployment Blueprint (`app.ts`)

```typescript
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

const app = express();

// 1. Security, Compression & Headers
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: ["[https://gakenye-ndiritu.co.ke](https://gakenye-ndiritu.co.ke)", "http://localhost:3000"],
  credentials: true,
}));

// 2. Rate Limiting for API Security
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

// 3. Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. API Routes Mounting Point
// app.use("/api/v1/auth", authRoutes);
// app.use("/api/v1/tickets", ticketRoutes);

// 5. Centralized Error-Handling Middleware (Must be last)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;