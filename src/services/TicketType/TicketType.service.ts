import  db  from "../../drizzle/db";
import { events, ticketTypes, TInsertTicketType, TSelectTicketType } from "../../drizzle/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";

export const createTicketTypeService = async (data: TInsertTicketType): Promise<TSelectTicketType> => {
  // 1. Verify event exists
  const event = await db.query.events.findFirst({
    where: eq(events.eventId, data.eventId),
  });
  if (!event) {
    throw new Error("Event not found");
  }

  // 2. Check for duplicate ticket type name under the same event
  const existingTicketType = await db.query.ticketTypes.findFirst({
    where: and(
      eq(ticketTypes.eventId, data.eventId),
      eq(ticketTypes.name, data.name)
    ),
  });

  if (existingTicketType) {
    throw new Error(`A ticket type with the name '${data.name}' already exists for this event 🚫`);
  }

  // 3. Insert new ticket type
  const [created] = await db.insert(ticketTypes).values(data).returning();
  return created;
};

// ==========================================
// 2. GET TICKET TYPE BY ID
// ==========================================
export const getTicketTypeByIdService = async (ticketTypeId: number): Promise<TSelectTicketType | undefined> => {
  const [ticketType] = await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.ticketTypeId, ticketTypeId));
  return ticketType;
};

// ==========================================
// 3. GET TICKET TYPES BY EVENT ID
// ==========================================
export const getTicketTypesByEventIdService = async (eventId: number): Promise<TSelectTicketType[]> => {
  return await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.eventId, eventId));
};

// ==========================================
// 4. UPDATE TICKET TYPE DETAILS
// ==========================================
export const updateTicketTypeService = async (
  ticketTypeId: number,
  data: Partial<TInsertTicketType>
): Promise<TSelectTicketType | undefined> => {
  const [updated] = await db
    .update(ticketTypes)
    .set(data)
    .where(eq(ticketTypes.ticketTypeId, ticketTypeId))
    .returning();
  return updated;
};

// ==========================================
// 5. INCREMENT TICKETS SOLD (PURCHASE)
// ==========================================
export const incrementTicketTypeSoldService = async (
  ticketTypeId: number,
  count: number = 1
): Promise<TSelectTicketType | undefined> => {
  const [updated] = await db
    .update(ticketTypes)
    .set({
      sold: sql`${ticketTypes.sold} + ${count}`,
    })
    .where(eq(ticketTypes.ticketTypeId, ticketTypeId))
    .returning();
  return updated;
};

// ==========================================
// 6. DECREMENT TICKETS SOLD (REFUND/CANCEL)
// ==========================================
export const decrementTicketTypeSoldService = async (
  ticketTypeId: number,
  count: number = 1
): Promise<TSelectTicketType | undefined> => {
  const [updated] = await db
    .update(ticketTypes)
    .set({
      sold: sql`GREATEST(0, ${ticketTypes.sold} - ${count})`,
    })
    .where(eq(ticketTypes.ticketTypeId, ticketTypeId))
    .returning();
  return updated;
};

// ==========================================
// 7. CHECK TICKET TYPE AVAILABILITY
// ==========================================
export const checkTicketTypeAvailabilityService = async (
  ticketTypeId: number,
  requestedQuantity: number
): Promise<boolean> => {
  const ticketType = await getTicketTypeByIdService(ticketTypeId);
  if (!ticketType) return false;
  
  const currentSold = ticketType.sold ?? 0;
  const remaining = ticketType.quantity - currentSold;
  return remaining >= requestedQuantity;
};

// ==========================================
// 8. DELETE TICKET TYPE
// ==========================================
export const deleteTicketTypeService = async (ticketTypeId: number): Promise<boolean> => {
  const result = await db
    .delete(ticketTypes)
    .where(eq(ticketTypes.ticketTypeId, ticketTypeId))
    .returning();
  return result.length > 0;
};

// ==========================================
// 9. COUNT TICKET TYPES BY EVENT
// ==========================================
export const getTotalTicketTypesCountByEventService = async (eventId: number): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(ticketTypes)
    .where(eq(ticketTypes.eventId, eventId));
  return Number(result[0]?.count || 0);
};

// ==========================================
// 10. GET TICKET TYPE WITH EVENT RELATION
// ==========================================
export const getTicketTypeWithEventService = async (ticketTypeId: number) => {
  return await db.query.ticketTypes.findFirst({
    where: eq(ticketTypes.ticketTypeId, ticketTypeId),
    with: {
      event: true,
    },
  });
};

// ==========================================
// 11. GET TOTAL REMAINING TICKETS FOR AN EVENT
// ==========================================
export const getTotalRemainingTicketsByEventService = async (eventId: number): Promise<number> => {
  const types = await getTicketTypesByEventIdService(eventId);
  return types.reduce((total, t) => total + (t.quantity - (t.sold ?? 0)), 0);
};

// ==========================================
// 12. CALCULATE REVENUE GENERATED BY TICKET TYPE
// ==========================================
export const getTicketTypeRevenueService = async (ticketTypeId: number): Promise<number> => {
  const ticketType = await getTicketTypeByIdService(ticketTypeId);
  if (!ticketType) return 0;
  
  const priceNum = Number(ticketType.price);
  const currentSold = ticketType.sold ?? 0;
  return currentSold * priceNum;
};

// ==========================================
// 13. BULK CREATE TICKET TYPES SERVICE
// ==========================================
export const bulkCreateTicketTypesService = async (eventId: number, rawTicketTypes: Omit<TInsertTicketType, "eventId">[]): Promise<TSelectTicketType[]> => {
  // 1. Verify event exists
  const event = await db.query.events.findFirst({
    where: eq(events.eventId, eventId),
  });
  if (!event) {
    throw new Error("Event not found");
  }

  // 2. Check for duplicates within the incoming array payload itself
  const namesSet = new Set();
  for (const t of rawTicketTypes) {
    if (namesSet.has(t.name)) {
      throw new Error(`Duplicate ticket type name '${t.name}' found in the bulk request payload 🚫`);
    }
    namesSet.add(t.name);
  }

  // 3. Check against existing ticket types in the database for this event
  for (const t of rawTicketTypes) {
    const existing = await db.query.ticketTypes.findFirst({
      where: and(
        eq(ticketTypes.eventId, eventId),
        eq(ticketTypes.name, t.name)
      ),
    });
    if (existing) {
      throw new Error(`A ticket type named '${t.name}' already exists for this event 🚫`);
    }
  }

  // 4. Map and insert all
  const formattedData = rawTicketTypes.map((t) => ({ ...t, eventId }));
  const createdTiers = await db.insert(ticketTypes).values(formattedData).returning();
  return createdTiers;
};

// ==========================================
// 14. GET AVAILABLE TICKET TYPES ONLY (STOCK > 0)
// ==========================================
export const getAvailableTicketTypesByEventService = async (eventId: number): Promise<TSelectTicketType[]> => {
  const types = await getTicketTypesByEventIdService(eventId);
  return types.filter(t => (t.quantity - (t.sold ?? 0)) > 0);
};

// ==========================================
// 15. CHECK IF TICKET TYPE IS SOLD OUT
// ==========================================
export const isTicketTypeSoldOutService = async (ticketTypeId: number): Promise<boolean> => {
  const ticketType = await getTicketTypeByIdService(ticketTypeId);
  if (!ticketType) return true;
  
  const currentSold = ticketType.sold ?? 0;
  return currentSold >= ticketType.quantity;
};

// ==========================================
// 16. UPDATE TICKET TYPE CAPACITY (QUANTITY)
// ==========================================
export const updateTicketTypeCapacityService = async (
  ticketTypeId: number,
  newQuantity: number
): Promise<TSelectTicketType | undefined> => {
  const ticketType = await getTicketTypeByIdService(ticketTypeId);
  if (!ticketType) return undefined;
  
  const currentSold = ticketType.sold ?? 0;
  if (newQuantity < currentSold) {
    throw new Error("New quantity cannot be less than the number of tickets already sold.");
  }

  const [updated] = await db
    .update(ticketTypes)
    .set({ quantity: newQuantity })
    .where(eq(ticketTypes.ticketTypeId, ticketTypeId))
    .returning();
    
  return updated;
};

// ==========================================
// 17. GET TOTAL EVENT REVENUE ACROSS ALL TICKET TYPES
// ==========================================
export const getTotalEventTicketRevenueService = async (eventId: number): Promise<number> => {
  const types = await getTicketTypesByEventIdService(eventId);
  return types.reduce((sum, t) => sum + ((t.sold ?? 0) * Number(t.price)), 0);
};

// ==========================================
// 18. DELETE ALL TICKET TYPES FOR AN EVENT
// ==========================================
export const deleteAllTicketTypesByEventService = async (eventId: number): Promise<boolean> => {
  const result = await db
    .delete(ticketTypes)
    .where(eq(ticketTypes.eventId, eventId))
    .returning();
  return result.length > 0;
};

// ==========================================
// 19. RESET TICKETS SOLD COUNT TO ZERO
// ==========================================
export const resetTicketTypeSoldService = async (ticketTypeId: number): Promise<TSelectTicketType | undefined> => {
  const [updated] = await db
    .update(ticketTypes)
    .set({ sold: 0 })
    .where(eq(ticketTypes.ticketTypeId, ticketTypeId))
    .returning();
  return updated;
};

// ==========================================
// 20. UPDATE TICKET TYPE PRICE
// ==========================================
export const updateTicketTypePriceService = async (
  ticketTypeId: number,
  newPrice: string | number
): Promise<TSelectTicketType | undefined> => {
  const [updated] = await db
    .update(ticketTypes)
    .set({ price: newPrice.toString() })
    .where(eq(ticketTypes.ticketTypeId, ticketTypeId))
    .returning();
  return updated;
};

// ==========================================
// 21. CLONE TICKET TYPES TO A NEW EVENT
// ==========================================
export const cloneTicketTypesForEventService = async (
  sourceEventId: number,
  targetEventId: number
): Promise<TSelectTicketType[]> => {
  const sourceTypes = await getTicketTypesByEventIdService(sourceEventId);
  if (sourceTypes.length === 0) return [];

  const newTicketTypesData: TInsertTicketType[] = sourceTypes.map((t) => ({
    eventId: targetEventId,
    name: t.name,
    price: t.price,
    quantity: t.quantity,
    sold: 0,
  }));

  return await db.insert(ticketTypes).values(newTicketTypesData).returning();
};

// ==========================================
// 22. GET TICKET TYPES BY PRICE RANGE
// ==========================================
export const getTicketTypesByPriceRangeService = async (
  eventId: number,
  minPrice: number,
  maxPrice: number
): Promise<TSelectTicketType[]> => {
  return await db
    .select()
    .from(ticketTypes)
    .where(
      and(
        eq(ticketTypes.eventId, eventId),
        gte(ticketTypes.price, minPrice.toString()),
        lte(ticketTypes.price, maxPrice.toString())
      )
    );
};

// ==========================================
// 23. VALIDATE TICKET TYPE BELONGS TO EVENT
// ==========================================
export const validateTicketTypeBelongsToEventService = async (
  ticketTypeId: number,
  eventId: number
): Promise<boolean> => {
  const ticketType = await getTicketTypeByIdService(ticketTypeId);
  if (!ticketType) return false;
  return ticketType.eventId === eventId;
};

// ==========================================
// 24. GET EVENT TICKET INVENTORY SUMMARY REPORT
// ==========================================
export const getEventTicketInventorySummaryService = async (eventId: number) => {
  const types = await getTicketTypesByEventIdService(eventId);
  
  const totalCapacity = types.reduce((sum, t) => sum + t.quantity, 0);
  const totalSold = types.reduce((sum, t) => sum + (t.sold ?? 0), 0);
  const totalRemaining = totalCapacity - totalSold;
  const potentialRevenue = types.reduce((sum, t) => sum + (t.quantity * Number(t.price)), 0);
  const actualRevenue = types.reduce((sum, t) => sum + ((t.sold ?? 0) * Number(t.price)), 0);

  return {
    eventId,
    totalTicketTiers: types.length,
    totalCapacity,
    totalSold,
    totalRemaining,
    potentialRevenue,
    actualRevenue,
    sellThroughRate: totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0,
  };
};