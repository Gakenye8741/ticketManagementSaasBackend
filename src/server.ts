import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { createServer } from 'node:http';

// Route Imports
import { authRouter } from './auth/auth.route';
import { userRouter } from './services/users/user.route';

import { venueRoute } from './services/venue/venue.route';
import { eventRouter } from './services/events/events.route';
import { bookingRouter } from './services/bookings/bookings.route';
import mediaRouter from './services/media/media.route';
import responseRoute from './services/AdminResponses/response.route';
import sendTicketEmailRoute from './middleware/emailTicket';
import MpesaRoute from './services/payments/Mpesa/Mpesa.route';
import qrTicketRoutes from './services/qrcodeTickets/qrcode.route';
import { webhookHandler } from './services/payments/payment.webhook';
import OrgRouter from './services/Organization/Organization.route';
import walletRouter from './services/Wallet/Wallet.route';

import paymentRouter from './services/payments/payments.route';
import TicketRouter from './services/tickets/ticket.route';
import TicketTypeRouter from './services/TicketType/tickettype.route';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// Initialize structured logger for lightning-fast asynchronous logging
const loggerInstance = pino({
  level: isProd ? 'info' : 'debug',
  transport: !isProd ? { target: 'pino-pretty' } : undefined,
});

// Trust proxy if running behind Nginx / Cloudflare load balancer
// (required so `secure` cookies work behind a TLS-terminating proxy)
app.set('trust proxy', 1);

// ==========================================
// 1. WEBHOOKS (Must be raw before global json parser)
// ==========================================
app.post("/api/payment/webhook", express.raw({ type: "application/json" }), webhookHandler);

// ==========================================
// 2. SECURITY, COMPRESSION & GLOBAL MIDDLEWARE
// ==========================================
app.use(helmet()); // Sets secure HTTP response headers
app.use(compression()); // Gzip/Brotli compression for maximum transfer speed

const allowedOrigins = [
  "http://localhost:5173", 
  "https://ticketstream-events.netlify.app",
  "https://ticketstream.gakenye-ndiritu.co.ke",
  "https://www.ticketstream.gakenye-ndiritu.co.ke",
  "https://gakenye-ndiritu.co.ke",
  "https://www.gakenye-ndiritu.co.ke",
  ...(process.env.EXTRA_ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? []),
];

app.use(cors({
  origin: (origin, callback) => {
    // No origin = curl, Postman, REST Client (.http files), server-to-server
    if (!origin || allowedOrigins.includes(origin) || NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy: Unauthorized Origin'));
    }
  },
  credentials: true, // lets the browser send/receive the HttpOnly `token` cookie
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Global Rate Limiter to protect against DDoS, brute-force, and bot scrapers
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests from this IP, please try again later." }
});
app.use("/api/", globalLimiter);

// Parse Cookies (must run BEFORE any route/auth middleware), JSON & URL-encoded payloads
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// High-speed HTTP request logger
app.use(pinoHttp({ logger: loggerInstance }));

// Temporary auth debugging. Enable with DEBUG_AUTH=true, then remove when solved.
// Shows whether the cookie actually reaches the server (never logs the token itself).
if (process.env.DEBUG_AUTH === 'true') {
  app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
    (req as any).log.info(
      {
        url: (req as any).originalUrl,
        origin: (req as any).headers.origin,
        hasCookieHeader: !!(req as any).headers.cookie,
        hasTokenCookie: !!(req as any).cookies?.token,
        hasAuthHeader: !!(req as any).headers.authorization,
      },
      'auth debug'
    );
    next();
  });
}

// ==========================================
// 3. HEALTH CHECK & SYSTEM STATUS
// ==========================================
app.get('/', (_req: Request, res: Response) => {
  (res as any).status(200).json({
    success: true,
    message: "🚀 TicketStream High-Performance Engine Operational",
    architecture: "Node.js / Express / Drizzle ORM",
    developer: "Gakenye Ndiritu",
    environment: NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 4. API ROUTE REGISTRATION (With Safety Guard)
// ORDER MATTERS: specific prefixes first, generic '/api' mounts last.
// A router mounted at '/api' that uses router-level auth (router.use(auth))
// would otherwise intercept every request below it and reject it with
// "Authentication token is missing" before the intended router is reached.
// ==========================================
const apiRoutes = [
  // --- Specific prefixes first ---
  { path: '/api/auth', router: authRouter },
  { path: '/api/organizations', router: OrgRouter },
  { path: '/api/media', router: mediaRouter },
  { path: '/api/tickets', router: TicketRouter },
  { path: '/api/tickettypes', router: TicketTypeRouter },
  { path: '/api/payments', router: paymentRouter },
  { path: '/api/ticket', router: qrTicketRoutes },

  // --- Generic '/api' mounts last (make sure these use per-route auth, not router.use(auth)) ---
  { path: '/api', router: userRouter },
  { path: '/api', router: venueRoute },
  { path: '/api', router: eventRouter },
  { path: '/api', router: bookingRouter },
  { path: '/api', router: responseRoute },
  { path: '/api', router: sendTicketEmailRoute },
  { path: '/api', router: MpesaRoute },
  { path: '/api', router: walletRouter },
];

apiRoutes.forEach(({ path, router }) => {
  if (typeof router === 'function') {
    app.use(path, router);
  } else {
    loggerInstance.warn({ path }, "⚠️ Route registration skipped: Imported module is not a valid Express router function.");
  }
});

// ==========================================
// 5. CENTRALIZED ERROR-HANDLING MIDDLEWARE
// ==========================================

// 404 handler (must come after all routes)
app.use((req: Request, res: Response, _next: NextFunction) => {
  (res as any).status(404).json({
    success: false,
    message: `Route not found: ${(req as any).method} ${(req as any).originalUrl}`
  });
});

// Global error handler (4 arguments = Express treats it as an error handler).
// Turns CORS rejections and unexpected throws into clean JSON instead of HTML stack traces.
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const isCorsError = typeof err?.message === 'string' && err.message.startsWith('Blocked by CORS');
  const status = isCorsError ? 403 : err?.status || err?.statusCode || 500;

  (req as any).log?.error({ err }, 'Unhandled error');

  (res as any).status(status).json({
    success: false,
    message: isCorsError
      ? err.message
      : isProd && status === 500
        ? 'Internal server error'
        : err?.message || 'Internal server error',
  });
});

// ==========================================
// 6. SERVER INITIALIZATION & GRACEFUL SHUTDOWN
// ==========================================
const server = createServer(app).listen(PORT, () => {
  console.clear();
  console.log(`
  ==========================================================
  🚀 TICKETSTREAM HIGH-PERFORMANCE ENGINE INITIALIZED
  ----------------------------------------------------------
  Port:         ${PORT}
  Environment:  ${NODE_ENV}
  Process ID:   ${process.pid}
  Developer:    GAKENYE NDIRITU
  Status:       ⚡ Fully Optimized & Ready for Peak Scans
  ==========================================================
  `);
});

// Handle graceful shutdown on termination signals (PM2 / Docker / Systemd)
const shutdown = () => {
  loggerInstance.info("Received kill signal, shutting down gracefully...");
  server.close(() => {
    loggerInstance.info("HTTP server closed successfully.");
    process.exit(0);
  });

  // Force shutdown if connections hang for longer than 10 seconds
  setTimeout(() => {
    loggerInstance.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;