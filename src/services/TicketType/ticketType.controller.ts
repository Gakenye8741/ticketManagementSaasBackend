import { Request, Response, NextFunction } from 'express';
import {
  createTicketTypeSchema,
  updateTicketTypeSchema,
  bulkCreateTicketTypesSchema,
  updateTicketTypeCapacitySchema,
  updateTicketTypePriceSchema,
} from "../../validators/ticketTypes.validator"; // Adjust path to where your validation schemas are stored
import { bulkCreateTicketTypesService, checkTicketTypeAvailabilityService, cloneTicketTypesForEventService, createTicketTypeService, decrementTicketTypeSoldService, deleteAllTicketTypesByEventService, deleteTicketTypeService, getAvailableTicketTypesByEventService, getEventTicketInventorySummaryService, getTicketTypeByIdService, getTicketTypeRevenueService, getTicketTypesByEventIdService, getTicketTypesByPriceRangeService, getTicketTypeWithEventService, getTotalEventTicketRevenueService, getTotalRemainingTicketsByEventService, getTotalTicketTypesCountByEventService, incrementTicketTypeSoldService, isTicketTypeSoldOutService, resetTicketTypeSoldService, updateTicketTypeCapacityService, updateTicketTypePriceService, updateTicketTypeService, validateTicketTypeBelongsToEventService } from './TicketType.service';

// ==========================================
// 1. CREATE TICKET TYPE
// ==========================================
export const createTicketTypeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createTicketTypeSchema.parse(req.body);
    const data = await createTicketTypeService(validatedData);
    
    return res.status(201).json({ 
      success: true, 
      message: "TicketTier: The ticket tier has been created successfully and is now active for booking 🎟️", 
      data 
    });
  } catch (error: any) {
    // Check if the error is due to an already existing ticket type name
    if (error.message && error.message.includes("already exists for this event")) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    // Pass any other unexpected errors to the global error handler
    next(error);
  }
};

// ==========================================
// 2. GET TICKET TYPE BY ID
// ==========================================
export const getTicketTypeByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const data = await getTicketTypeByIdService(id);
    if (!data) return res.status(404).json({ success: false, message: "TicketTier: Requested ticket type tier could not be located in the system ❌" });
    return res.status(200).json({ success: true, message: "TicketTier: Ticket tier details retrieved successfully 🔍", data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. GET TICKET TYPES BY EVENT ID
// ==========================================
export const getTicketTypesByEventIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    const data = await getTicketTypesByEventIdService(eventId);
    return res.status(200).json({ success: true, message: "TicketTier: All available ticket tiers for this event were fetched successfully 📋", count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. UPDATE TICKET TYPE DETAILS
// ==========================================
export const updateTicketTypeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const validatedData = updateTicketTypeSchema.parse(req.body);
    const data = await updateTicketTypeService(id, validatedData);
    if (!data) return res.status(404).json({ success: false, message: "TicketTier: Update failed because the specified ticket type does not exist ❌" });
    return res.status(200).json({ success: true, message: "TicketTier: Ticket tier configurations updated successfully ✨", data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. INCREMENT TICKETS SOLD
// ==========================================
export const incrementTicketTypeSoldController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const count = Number(req.body.count || 1);
    const data = await incrementTicketTypeSoldService(id, count);
    if (!data) return res.status(404).json({ success: false, message: "TicketTier: Could not increment sales count as the ticket type was not found ❌" });
    return res.status(200).json({ success: true, message: "TicketTier: Ticket sales count incremented successfully following purchase 📈", data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 6. DECREMENT TICKETS SOLD
// ==========================================
export const decrementTicketTypeSoldController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const count = Number(req.body.count || 1);
    const data = await decrementTicketTypeSoldService(id, count);
    if (!data) return res.status(404).json({ success: false, message: "TicketTier: Could not decrement sales count as the ticket type was not found ❌" });
    return res.status(200).json({ success: true, message: "TicketTier: Ticket sales count decremented successfully following cancellation 📉", data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 7. CHECK TICKET TYPE AVAILABILITY
// ==========================================
export const checkTicketTypeAvailabilityController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const quantity = Number(req.query.quantity || 1);
    const isAvailable = await checkTicketTypeAvailabilityService(id, quantity);
    return res.status(200).json({ success: true, message: "TicketTier: Availability check executed successfully ✅", ticketTypeId: id, requestedQuantity: quantity, isAvailable });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 8. DELETE TICKET TYPE
// ==========================================
export const deleteTicketTypeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const success = await deleteTicketTypeService(id);
    if (!success) return res.status(404).json({ success: false, message: "TicketTier: Deletion failed because the target ticket tier does not exist ❌" });
    return res.status(200).json({ success: true, message: "TicketTier: Ticket tier has been successfully purged from the system 🗑️" });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 9. COUNT TICKET TYPES BY EVENT
// ==========================================
export const getTotalTicketTypesCountByEventController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    const count = await getTotalTicketTypesCountByEventService(eventId);
    return res.status(200).json({ success: true, message: "TicketTier: Total ticket tier count calculated successfully 📊", eventId, totalTicketTypes: count });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 10. GET TICKET TYPE WITH EVENT RELATION
// ==========================================
export const getTicketTypeWithEventController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const data = await getTicketTypeWithEventService(id);
    if (!data) return res.status(404).json({ success: false, message: "TicketTier: Ticket type or its associated event relation was not found ❌" });
    return res.status(200).json({ success: true, message: "TicketTier: Ticket type and event relation fetched successfully 🔗", data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 11. GET TOTAL REMAINING TICKETS BY EVENT
// ==========================================
export const getTotalRemainingTicketsByEventController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    const remaining = await getTotalRemainingTicketsByEventService(eventId);
    return res.status(200).json({ success: true, message: "TicketTier: Remaining inventory calculated successfully across all tiers 🔢", eventId, totalRemaining: remaining });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 12. CALCULATE REVENUE GENERATED BY TICKET TYPE
// ==========================================
export const getTicketTypeRevenueController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const revenue = await getTicketTypeRevenueService(id);
    return res.status(200).json({ success: true, message: "TicketTier: Revenue report for ticket tier generated successfully 💵", ticketTypeId: id, revenue });
  } catch (error) {
    next(error);
  }
};


// ==========================================
// 13. BULK CREATE TICKET TYPES FOR AN EVENT
// ==========================================
export const bulkCreateTicketTypesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedBody = bulkCreateTicketTypesSchema.parse(req.body);
    
    const data = await bulkCreateTicketTypesService(validatedBody.eventId, validatedBody.ticketTypes);
    
    return res.status(201).json({ 
      success: true, 
      message: "TicketTier: Multiple ticket tiers have been created in bulk successfully 📦", 
      count: data.length, 
      data 
    });
  } catch (error: any) {
    // Check if the error is the duplicate ticket type error from the service
    if (error.message && error.message.includes("already exists for this event")) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    // Pass any other unexpected errors to the global error handler
    next(error);
  }
};

// ==========================================
// 14. GET AVAILABLE TICKET TYPES ONLY
// ==========================================
export const getAvailableTicketTypesByEventController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    const data = await getAvailableTicketTypesByEventService(eventId);
    return res.status(200).json({ success: true, message: "TicketTier: Filtered list of open and un-sold-out ticket tiers retrieved successfully ✨", count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 15. CHECK IF TICKET TYPE IS SOLD OUT
// ==========================================
export const isTicketTypeSoldOutController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const isSoldOut = await isTicketTypeSoldOutService(id);
    return res.status(200).json({ success: true, message: "TicketTier: Sold-out status verification completed successfully 🔍", ticketTypeId: id, isSoldOut });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 16. UPDATE TICKET TYPE CAPACITY
// ==========================================
export const updateTicketTypeCapacityController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { quantity } = updateTicketTypeCapacitySchema.parse(req.body);
    const data = await updateTicketTypeCapacityService(id, quantity);
    if (!data) return res.status(404).json({ success: false, message: "TicketTier: Target ticket tier not found for capacity modification ❌" });
    return res.status(200).json({ success: true, message: "TicketTier: Maximum ticket tier capacity updated successfully 📊", data });
  } catch (error: any) {
    if (error.message?.includes("cannot be less than")) {
      return res.status(400).json({ success: false, message: `TicketTier: ${error.message}` });
    }
    next(error);
  }
};

// ==========================================
// 17. GET TOTAL EVENT TICKET REVENUE
// ==========================================
export const getTotalEventTicketRevenueController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    const totalRevenue = await getTotalEventTicketRevenueService(eventId);
    return res.status(200).json({ success: true, message: "TicketTier: Cumulative aggregate event revenue computed successfully 📈", eventId, totalRevenue });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 18. DELETE ALL TICKET TYPES FOR AN EVENT
// ==========================================
export const deleteAllTicketTypesByEventController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    await deleteAllTicketTypesByEventService(eventId);
    return res.status(200).json({ success: true, message: "TicketTier: All associated ticket tiers for this event have been cleared successfully 🗑️" });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 19. RESET TICKETS SOLD COUNT TO ZERO
// ==========================================
export const resetTicketTypeSoldController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const data = await resetTicketTypeSoldService(id);
    if (!data) return res.status(404).json({ success: false, message: "TicketTier: Ticket tier could not be found to reset sales counters ❌" });
    return res.status(200).json({ success: true, message: "TicketTier: Sales metrics counter reset back to zero successfully 🔄", data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 20. UPDATE TICKET TYPE PRICE
// ==========================================
export const updateTicketTypePriceController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { price } = updateTicketTypePriceSchema.parse(req.body);
    const data = await updateTicketTypePriceService(id, price);
    if (!data) return res.status(404).json({ success: false, message: "TicketTier: Ticket tier not found for price adjustment ❌" });
    return res.status(200).json({ success: true, message: "TicketTier: Ticket tier pricing structure updated successfully 💵", data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 21. CLONE TICKET TYPES TO A NEW EVENT
// ==========================================
export const cloneTicketTypesForEventController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceEventId, targetEventId } = req.body;
    const data = await cloneTicketTypesForEventService(sourceEventId, targetEventId);
    return res.status(201).json({ success: true, message: "TicketTier: Ticket tiers successfully duplicated to the new event 🧬", count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 22. GET TICKET TYPES BY PRICE RANGE
// ==========================================
export const getTicketTypesByPriceRangeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    const minPrice = Number(req.query.minPrice || 0);
    const maxPrice = Number(req.query.maxPrice || 1000000);
    const data = await getTicketTypesByPriceRangeService(eventId, minPrice, maxPrice);
    return res.status(200).json({ success: true, message: "TicketTier: Filtered ticket tiers matching price parameters fetched successfully 🏷️", count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 23. VALIDATE TICKET TYPE BELONGS TO EVENT
// ==========================================
export const validateTicketTypeBelongsToEventController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const eventId = Number(req.query.eventId);
    const isValid = await validateTicketTypeBelongsToEventService(id, eventId);
    return res.status(200).json({ success: true, message: "TicketTier: Relationship validation query executed successfully 🔍", ticketTypeId: id, eventId, isValid });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 24. GET EVENT TICKET INVENTORY SUMMARY REPORT
// ==========================================
export const getEventTicketInventorySummaryController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    const summary = await getEventTicketInventorySummaryService(eventId);
    return res.status(200).json({ success: true, message: "TicketTier: Comprehensive event inventory analytics summary compiled successfully 📊", data: summary });
  } catch (error) {
    next(error);
  }
};