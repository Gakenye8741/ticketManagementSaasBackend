import { and, desc, eq, inArray, sql } from "drizzle-orm";
import db from "../../drizzle/db";
import { media, TInsertMedia, TSelectMedia } from "../../drizzle/schema";


/**
 * Helper utility to clear primary flags for an event
 */
export const unsetPrimaryMedia = async (eventId: number): Promise<void> => {
  await db
    .update(media)
    .set({ isPrimary: false })
    .where(and(eq(media.eventId, eventId), eq(media.isPrimary, true)));
};

/**
 * 1. Create a single media record
 */
export const createMedia = async (data: TInsertMedia): Promise<TSelectMedia> => {
  if (data.isPrimary && data.eventId) {
    await unsetPrimaryMedia(data.eventId);
  }

  const [newMedia] = await db.insert(media).values(data).returning();
  return newMedia;
};

/**
 * 2. Bulk create multiple media items for an event
 */
export const bulkCreateMedia = async (items: TInsertMedia[]): Promise<TSelectMedia[]> => {
  if (items.length === 0) return [];
  
  const eventId = items[0].eventId;
  const hasPrimary = items.some((item) => item.isPrimary);
  
  if (hasPrimary && eventId) {
    await unsetPrimaryMedia(eventId);
  }

  const insertedMedia = await db.insert(media).values(items).returning();
  return insertedMedia;
};

/**
 * 3. Find a single media record by ID
 */
export const getMediaById = async (mediaId: number): Promise<TSelectMedia | null> => {
  const record = await db.query.media.findFirst({
    where: eq(media.mediaId, mediaId),
    with: {
      event: true,
    },
  });
  return (record as TSelectMedia) || null;
};

/**
 * 4. Get all media files associated with a specific event
 */
export const getMediaByEventId = async (eventId: number): Promise<TSelectMedia[]> => {
  const records = await db.query.media.findMany({
    where: eq(media.eventId, eventId),
    orderBy: [desc(media.isPrimary), desc(media.createdAt)],
  });
  return records as TSelectMedia[];
};

/**
 * 5. Get primary (cover/banner) media for an event
 */
export const getPrimaryMediaByEventId = async (eventId: number): Promise<TSelectMedia | null> => {
  const record = await db.query.media.findFirst({
    where: and(eq(media.eventId, eventId), eq(media.isPrimary, true)),
  });
  return (record as TSelectMedia) || null;
};

/**
 * 6. Get media filtered by type (e.g., 'banner' | 'gallery' | 'poster')
 */
export const getMediaByType = async (eventId: number, type: "image" | "video"): Promise<TSelectMedia[]> => {
  const records = await db.query.media.findMany({
    where: and(eq(media.eventId, eventId), eq(media.type, type)),
    orderBy: [desc(media.createdAt)],
  });
  return records as TSelectMedia[];
};

/**
 * 7. Update a media record's metadata
 */
export const updateMedia = async (
  mediaId: number,
  updates: Partial<TInsertMedia>
): Promise<TSelectMedia | undefined> => {
  if (updates.isPrimary) {
    const current = await getMediaById(mediaId);
    if (current && current.eventId) {
      await unsetPrimaryMedia(current.eventId);
    }
  }

  const [updated] = await db
    .update(media)
    .set(updates)
    .where(eq(media.mediaId, mediaId))
    .returning();
  return updated as TSelectMedia;
};

/**
 * 8. Set a specific media item as primary for its event
 */
export const setAsPrimary = async (mediaId: number): Promise<TSelectMedia> => {
  const targetMedia = await getMediaById(mediaId);
  if (!targetMedia || !targetMedia.eventId) throw new Error("Media record not found or has no associated event");

  await unsetPrimaryMedia(targetMedia.eventId);

  const [updated] = await db
    .update(media)
    .set({ isPrimary: true })
    .where(eq(media.mediaId, mediaId))
    .returning();

  return updated as TSelectMedia;
};

/**
 * 9. Delete a single media record by ID
 */
export const deleteMedia = async (mediaId: number): Promise<TSelectMedia | undefined> => {
  const [deleted] = await db
    .delete(media)
    .where(eq(media.mediaId, mediaId))
    .returning();
  return deleted as TSelectMedia;
};

/**
 * 10. Delete multiple media items in bulk
 */
export const bulkDeleteMedia = async (mediaIds: number[]): Promise<TSelectMedia[]> => {
  if (mediaIds.length === 0) return [];
  const deleted = await db
    .delete(media)
    .where(inArray(media.mediaId, mediaIds))
    .returning();
  return deleted as TSelectMedia[];
};

/**
 * 11. Delete all media attached to a specific event
 */
export const deleteAllEventMedia = async (eventId: number): Promise<TSelectMedia[]> => {
  const deleted = await db
    .delete(media)
    .where(eq(media.eventId, eventId))
    .returning();
  return deleted as TSelectMedia[];
};

/**
 * 12. Count total media files for an event
 */
export const countEventMedia = async (eventId: number): Promise<number> => {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(media)
    .where(eq(media.eventId, eventId));
  return Number(result?.count || 0);
};

/**
 * 13. Count media files grouped by type for an event
 */
export const getEventMediaStats = async (eventId: number) => {
  const stats = await db
    .select({
      type: media.type,
      count: sql<number>`count(*)`,
    })
    .from(media)
    .where(eq(media.eventId, eventId))
    .groupBy(media.type);
  return stats;
};

/**
 * 14. Paginated retrieval of media across all events (Admin utility)
 */
export const getAllMediaPaginated = async (limit: number = 20, offset: number = 0): Promise<TSelectMedia[]> => {
  const records = await db.query.media.findMany({
    limit,
    offset,
    orderBy: [desc(media.createdAt)],
    with: {
      event: true,
    },
  });
  return records as TSelectMedia[];
};

/**
 * 15. Search media by matching alt text keywords
 */
export const searchMediaByAltText = async (searchTerm: string): Promise<TSelectMedia[]> => {
  const records = await db.query.media.findMany({
    where: sql`${media.altText} ILIKE ${`%${searchTerm}%`}`,
    orderBy: [desc(media.createdAt)],
  });
  return records as TSelectMedia[];
};

/**
 * 16. Duplicate/Copy media references from one event to another
 */
export const cloneEventMedia = async (sourceEventId: number, targetEventId: number): Promise<TSelectMedia[]> => {
  const sourceMedia = await getMediaByEventId(sourceEventId);
  if (sourceMedia.length === 0) return [];

  const newMediaPayload: TInsertMedia[] = sourceMedia.map((m) => ({
    eventId: targetEventId,
    url: m.url,
    type: m.type,
    altText: m.altText,
    isPrimary: m.isPrimary,
  }));

  return await bulkCreateMedia(newMediaPayload);
};

/**
 * 17. Retrieve recently uploaded media platform-wide
 */
export const getRecentMedia = async (limit: number = 10): Promise<TSelectMedia[]> => {
  const records = await db.query.media.findMany({
    limit,
    orderBy: [desc(media.createdAt)],
    with: {
      event: true,
    },
  });
  return records as TSelectMedia[];
};

/**
 * 18. Validate if a media record belongs to a specific event
 */
export const verifyMediaBelongsToEvent = async (mediaId: number, eventId: number): Promise<boolean> => {
  const record = await db.query.media.findFirst({
    where: and(eq(media.mediaId, mediaId), eq(media.eventId, eventId)),
    columns: { mediaId: true },
  });
  return !!record;
};

/**
 * 19. Batch update alt text tags for multiple media assets
 */
export const batchUpdateAltText = async (updates: Array<{ mediaId: number; altText: string }>): Promise<TSelectMedia[]> => {
  const results: TSelectMedia[] = [];
  for (const update of updates) {
    const [updated] = await db
      .update(media)
      .set({ altText: update.altText })
      .where(eq(media.mediaId, update.mediaId))
      .returning();
    if (updated) results.push(updated as TSelectMedia);
  }
  return results;
};