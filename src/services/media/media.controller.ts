import { Request, Response } from "express";
import * as mediaService from "./media.service";
import {
  createMediaSchema,
  bulkCreateMediaSchema,
  updateMediaSchema,
  mediaIdParamSchema,
  eventIdParamSchema,
  cloneMediaSchema,
  bulkDeleteMediaSchema,
  batchUpdateAltTextSchema,
} from "../../validators/media.validator";

/**
 * 1. Create a single media record
 */
export const createMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createMediaSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.format() });
      return;
    }

    const newMedia = await mediaService.createMedia(validation.data);
    res.status(201).json({ message: "Media created successfully", data: newMedia });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 2. Bulk create multiple media items
 */
export const bulkCreateMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = bulkCreateMediaSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.format() });
      return;
    }

    const created = await mediaService.bulkCreateMedia(validation.data.items);
    res.status(201).json({ message: "Media items created successfully", data: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 3. Find a single media record by ID
 */
export const getMediaById = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = mediaIdParamSchema.safeParse({ mediaId: req.params.id });
    if (!paramValidation.success) {
      res.status(400).json({ error: paramValidation.error.format() });
      return;
    }

    const record = await mediaService.getMediaById(paramValidation.data.mediaId);
    if (!record) {
      res.status(404).json({ error: "Media record not found" });
      return;
    }

    res.status(200).json({ data: record });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 4. Get all media files associated with a specific event
 */
export const getMediaByEventId = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = eventIdParamSchema.safeParse({ eventId: req.params.eventId });
    if (!paramValidation.success) {
      res.status(400).json({ error: paramValidation.error.format() });
      return;
    }

    const records = await mediaService.getMediaByEventId(paramValidation.data.eventId);
    res.status(200).json({ data: records });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 5. Get primary media for an event
 */
export const getPrimaryMediaByEventId = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = eventIdParamSchema.safeParse({ eventId: req.params.eventId });
    if (!paramValidation.success) {
      res.status(400).json({ error: paramValidation.error.format() });
      return;
    }

    const record = await mediaService.getPrimaryMediaByEventId(paramValidation.data.eventId);
    if (!record) {
      res.status(404).json({ error: "Primary media not found for this event" });
      return;
    }

    res.status(200).json({ data: record });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 6. Get media filtered by type ('banner' | 'gallery' | 'poster')
 */
export const getMediaByType = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = eventIdParamSchema.safeParse({ eventId: req.params.eventId });
    if (!paramValidation.success) {
      res.status(400).json({ error: paramValidation.error.format() });
      return;
    }

    const type = req.query.type as "image" | "video"; // Matches underlying service parameter expectation
    if (!["image", "video"].includes(type)) {
      res.status(400).json({ error: "Type query parameter must be 'image' or 'video'" });
      return;
    }

    const records = await mediaService.getMediaByType(paramValidation.data.eventId, type);
    res.status(200).json({ data: records });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 7. Update a media record's metadata
 */
export const updateMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = mediaIdParamSchema.safeParse({ mediaId: req.params.id });
    if (!paramValidation.success) {
      res.status(400).json({ error: paramValidation.error.format() });
      return;
    }

    const bodyValidation = updateMediaSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json({ error: bodyValidation.error.format() });
      return;
    }

    const updated = await mediaService.updateMedia(paramValidation.data.mediaId, bodyValidation.data);
    if (!updated) {
      res.status(404).json({ error: "Media record not found" });
      return;
    }

    res.status(200).json({ message: "Media updated successfully", data: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 8. Set a specific media item as primary for its event
 */
export const setAsPrimary = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = mediaIdParamSchema.safeParse({ mediaId: req.params.id });
    if (!paramValidation.success) {
      res.status(400).json({ error: paramValidation.error.format() });
      return;
    }

    const updated = await mediaService.setAsPrimary(paramValidation.data.mediaId);
    res.status(200).json({ message: "Media set as primary successfully", data: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to set primary media" });
  }
};

/**
 * 9. Delete a single media record by ID
 */
export const deleteMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = mediaIdParamSchema.safeParse({ mediaId: req.params.id });
    if (!paramValidation.success) {
      res.status(400).json({ error: paramValidation.error.format() });
      return;
    }

    const deleted = await mediaService.deleteMedia(paramValidation.data.mediaId);
    if (!deleted) {
      res.status(404).json({ error: "Media record not found" });
      return;
    }

    res.status(200).json({ message: "Media deleted successfully", data: deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 10. Delete multiple media items in bulk
 */
export const bulkDeleteMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = bulkDeleteMediaSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.format() });
      return;
    }

    const deleted = await mediaService.bulkDeleteMedia(validation.data.mediaIds);
    res.status(200).json({ message: "Media items deleted successfully", data: deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 11. Delete all media attached to a specific event
 */
export const deleteAllEventMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = eventIdParamSchema.safeParse({ eventId: req.params.eventId });
    if (!paramValidation.success) {
      res.status(400).json({ error: paramValidation.error.format() });
      return;
    }

    const deleted = await mediaService.deleteAllEventMedia(paramValidation.data.eventId);
    res.status(200).json({ message: "All event media deleted successfully", data: deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 12. Count total media files for an event
 */
export const countEventMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = eventIdParamSchema.safeParse({ eventId: req.params.eventId });
    if (!paramValidation.success) {
      res.status(400).json({ error: paramValidation.error.format() });
      return;
    }

    const count = await mediaService.countEventMedia(paramValidation.data.eventId);
    res.status(200).json({ data: { eventId: paramValidation.data.eventId, count } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 13. Count media files grouped by type for an event
 */
export const getEventMediaStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = eventIdParamSchema.safeParse({ eventId: req.params.eventId });
    if (!paramValidation.success) {
      res.status(400).json({ error: paramValidation.error.format() });
      return;
    }

    const stats = await mediaService.getEventMediaStats(paramValidation.data.eventId);
    res.status(200).json({ data: stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 14. Paginated retrieval of media across all events (Admin utility)
 */
export const getAllMediaPaginated = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;

    const records = await mediaService.getAllMediaPaginated(limit, offset);
    res.status(200).json({ data: records, pagination: { limit, offset } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 15. Search media by matching alt text keywords
 */
export const searchMediaByAltText = async (req: Request, res: Response): Promise<void> => {
  try {
    const searchTerm = (req.query.q as string) || "";
    const records = await mediaService.searchMediaByAltText(searchTerm);
    res.status(200).json({ data: records });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 16. Duplicate/Copy media references from one event to another
 */
export const cloneEventMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = cloneMediaSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.format() });
      return;
    }

    const { sourceEventId, targetEventId } = validation.data;
    const cloned = await mediaService.cloneEventMedia(sourceEventId, targetEventId);
    res.status(201).json({ message: "Media cloned successfully", data: cloned });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 17. Retrieve recently uploaded media platform-wide
 */
export const getRecentMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 10;
    const records = await mediaService.getRecentMedia(limit);
    res.status(200).json({ data: records });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 18. Validate if a media record belongs to a specific event
 */
export const verifyMediaBelongsToEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const mediaValidation = mediaIdParamSchema.safeParse({ mediaId: req.params.id });
    const eventValidation = eventIdParamSchema.safeParse({ eventId: req.params.eventId });

    if (!mediaValidation.success || !eventValidation.success) {
      res.status(400).json({ error: "Invalid media ID or event ID format" });
      return;
    }

    const isValid = await mediaService.verifyMediaBelongsToEvent(
      mediaValidation.data.mediaId,
      eventValidation.data.eventId
    );
    res.status(200).json({ data: { belongsToEvent: isValid } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * 19. Batch update alt text tags for multiple media assets
 */
export const batchUpdateAltText = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = batchUpdateAltTextSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.format() });
      return;
    }

    const updated = await mediaService.batchUpdateAltText(validation.data.updates);
    res.status(200).json({ message: "Alt text batch updated successfully", data: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};