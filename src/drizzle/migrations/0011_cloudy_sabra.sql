ALTER TABLE "scanner_logs" ADD COLUMN "clientScanId" varchar(64);--> statement-breakpoint
ALTER TABLE "scanner_logs" ADD CONSTRAINT "scanner_logs_clientScanId_unique" UNIQUE("clientScanId");