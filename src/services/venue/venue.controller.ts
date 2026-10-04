import { Request, Response } from "express";
import {
  getAllVenueServices,
  getVenueByIdServices,
  searchVenuesByName,
  CreateVenueServices,
  updateVenueServices,
  deleteVenueByIdServices,
  getVenueDetailsByNameService,
} from "./venue.service";
import { createVenueSchema, updateVenueSchema } from "../../validators/venue.validator";

// Get All Venues for Logged-in Organizer
export const getAllVenuesController = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized: Missing organization ID" });
    }

    const venues = await getAllVenueServices(orgId);
    return res.status(200).json({ success: true, data: venues });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// Get Venue by Name (Scoped to Organizer)
export const getVenueByNameController = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized: Missing organization ID" });
    }

    const rawName = req.params.name;
    const venueName = typeof rawName === "string" ? rawName : rawName[0];
    const venue = await getVenueByIdServices(venueName, orgId);

    if (!venue) {
      return res.status(404).json({ error: "Venue not found or unauthorized" });
    }

    return res.status(200).json({ success: true, data: venue });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// Search Venues by Name
export const searchVenuesController = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized: Missing organization ID" });
    }

    const queryQ = req.query.q;
    const searchTerm = typeof queryQ === "string" ? queryQ : "";
    const venues = await searchVenuesByName(searchTerm, orgId);

    return res.status(200).json({ success: true, count: venues.length, data: venues });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// Get Venue Details including Events
export const getVenueDetailsController = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized: Missing organization ID" });
    }

    const rawName = req.query.name;
    let venueName: string | undefined;

    if (typeof rawName === "string") {
      venueName = rawName;
    } else if (Array.isArray(rawName) && rawName.length > 0 && typeof rawName[0] === "string") {
      venueName = rawName[0];
    }

    if (!venueName) {
      return res.status(400).json({ error: "Venue name query parameter is required" });
    }

    const venueDetails = await getVenueDetailsByNameService(venueName, orgId);
    return res.status(200).json({ success: true, data: venueDetails });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// Create New Venue (Validated with Zod)
export const createVenueController = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized: Missing organization ID" });
    }

    const validationResult = createVenueSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.format(),
      });
    }

    const venueData = {
      ...validationResult.data,
      orgId,
    };

    const responseMessage = await CreateVenueServices(venueData as any);
    return res.status(201).json({ success: true, message: responseMessage });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// Update Venue (Validated with Zod)
export const updateVenueController = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized: Missing organization ID" });
    }

    const rawId = req.params.id;
    const venueId = parseInt(typeof rawId === "string" ? rawId : rawId[0], 10);

    const validationResult = updateVenueSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.format(),
      });
    }

    const responseMessage = await updateVenueServices(venueId, validationResult.data, orgId);
    return res.status(200).json({ success: true, message: responseMessage });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// Delete Venue by ID
export const deleteVenueController = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized: Missing organization ID" });
    }

    // Safely extract string from req.params.id
    const rawId = req.params.id;
    const venueId = parseInt(typeof rawId === "string" ? rawId : rawId[0], 10);

    const responseMessage = await deleteVenueByIdServices(venueId, orgId);
    return res.status(200).json({ success: true, message: responseMessage });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};