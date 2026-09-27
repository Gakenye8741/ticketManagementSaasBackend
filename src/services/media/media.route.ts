import { Router } from "express";
import * as mediaController from "./media.controller";
import {
  adminAuth,
  organizerAuth,
  scannerAuth,
  adminOrOrganizerAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth"; // Adjust path to your auth middleware file as needed

const mediaRouter = Router();

/**
 * ==========================================
 * WRITE & MODIFICATION ROUTES (Protected)
 * ==========================================
 */

// 1. Create a single media record (Admins or Organizers)
mediaRouter.post("/", adminOrOrganizerAuth, mediaController.createMedia);

// 2. Bulk create multiple media items (Admins or Organizers)
mediaRouter.post("/bulk", adminOrOrganizerAuth, mediaController.bulkCreateMedia);

// 16. Clone/Copy media references from one event to another (Admins or Organizers)
mediaRouter.post("/clone", adminOrOrganizerAuth, mediaController.cloneEventMedia);

// 19. Batch update alt text tags for multiple media assets (Admins or Organizers)
mediaRouter.patch("/alt-text/batch", adminOrOrganizerAuth, mediaController.batchUpdateAltText);

// 8. Set a specific media item as primary for its event (Admins or Organizers)
mediaRouter.patch("/:id/primary", adminOrOrganizerAuth, mediaController.setAsPrimary);

// 7. Update a media record's metadata (Admins or Organizers)
mediaRouter.patch("/:id", adminOrOrganizerAuth, mediaController.updateMedia);

// 9. Delete a single media record by ID (Admins or Organizers)
mediaRouter.delete("/:id", adminOrOrganizerAuth, mediaController.deleteMedia);

// 10. Delete multiple media items in bulk (Admins only)
mediaRouter.delete("/bulk/delete", adminAuth, mediaController.bulkDeleteMedia);


/**
 * ==========================================
 * READ, STATS & QUERY ROUTES
 * ==========================================
 */

// 14. Paginated retrieval of media across all events - Admin utility (Admins only)
mediaRouter.get("/admin/all", adminAuth, mediaController.getAllMediaPaginated);

// 17. Retrieve recently uploaded media platform-wide (Authenticated users)
mediaRouter.get("/recent", anyAuthenticatedUser, mediaController.getRecentMedia);

// 15. Search media by matching alt text keywords (Authenticated users)
mediaRouter.get("/search", anyAuthenticatedUser, mediaController.searchMediaByAltText);

// 4. Get all media files associated with a specific event
mediaRouter.get("/event/:eventId", mediaController.getMediaByEventId);

// 5. Get primary (cover/banner) media for an event
mediaRouter.get("/event/:eventId/primary", mediaController.getPrimaryMediaByEventId);

// 6. Get media filtered by type (e.g., 'image' | 'video')
mediaRouter.get("/event/:eventId/type", mediaController.getMediaByType);

// 12. Count total media files for an event
mediaRouter.get("/event/:eventId/count", mediaController.countEventMedia);

// 13. Count media files grouped by type for an event
mediaRouter.get("/event/:eventId/stats", mediaController.getEventMediaStats);

// 11. Delete all media attached to a specific event (Admins or Organizers)
mediaRouter.delete("/event/:eventId", adminOrOrganizerAuth, mediaController.deleteAllEventMedia);

// 18. Validate if a media record belongs to a specific event
mediaRouter.get("/:id/verify/:eventId", mediaController.verifyMediaBelongsToEvent);

// 3. Find a single media record by ID
mediaRouter.get("/:id", mediaController.getMediaById);

export default mediaRouter;