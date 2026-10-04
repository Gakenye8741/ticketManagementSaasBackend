import { ne } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import cron from "node-cron";
import { events } from "../drizzle/schema";
import db from "../drizzle/db";
import { updateEventStatusService } from "../services/events/eventBooking.service";


export const initEventStatusCron = () => {
  // Run every 2 minutes: "*/2 * * * *"
  cron.schedule("*/2 * * * *", async () => {
    try {
      const now = new Date();
      // Format current date as YYYY-MM-DD
      const currentDate = now.toISOString().split("T")[0];
      // Format current time as HH:MM:SS
      const currentTime = now.toTimeString().split(" ")[0];

      // 1. Transition UPCOMING -> IN_PROGRESS
      // Where event status is 'upcoming' and (date < today OR (date == today AND time <= now))
      const upcomingEvents = await db.query.events.findMany({
        where: and(
          eq(events.status, "upcoming"),
          ne(events.status, "cancelled")
        ),
      });

      for (const event of upcomingEvents) {
        // Combine event date and time into a single Date object for exact comparison
        const eventDateTime = new Date(`${event.date}T${event.time}`);
        
        if (now >= eventDateTime) {
          // Check if it's been ongoing for less than 6 hours, otherwise mark ended directly, or mark in_progress
          // For simplicity, if start time is reached, set to 'in_progress'
          await updateEventStatusService(event.eventId, "in_progress");
          console.log(`⏱️ Event [ID: ${event.eventId}] status updated to: in_progress`);
        }
      }

      // 2. Transition IN_PROGRESS -> ENDED
      // Assuming an event automatically ends 6 hours after its start time (adjust as needed)
      const inProgressEvents = await db.query.events.findMany({
        where: eq(events.status, "in_progress"),
      });

      for (const event of inProgressEvents) {
        const eventStartTime = new Date(`${event.date}T${event.time}`);
        // Add 6 hours duration to event start time (or configure based on your needs)
        const eventEndTime = new Date(eventStartTime.getTime() + 6 * 60 * 60 * 1000);

        if (now >= eventEndTime) {
          await updateEventStatusService(event.eventId, "ended");
          console.log(`🏁 Event [ID: ${event.eventId}] status updated to: ended`);
        }
      }
    } catch (error) {
      console.error("❌ Error running event status cron job:", error);
    }
  });

  console.log("🟢 Event Status Cron Job Initialized (Runs every 2 minutes)");
};