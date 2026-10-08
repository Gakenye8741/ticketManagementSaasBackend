import { Router } from "express";
import {
  getAllVenuesController,
  getVenueByNameController,
  searchVenuesController,
  getVenueDetailsController,
  createVenueController,
  updateVenueController,
  deleteVenueController,
  getPublicVenueByIdController, // NEW
} from "./venue.controller";
import { adminAuth, anyAuthenticatedUser, organizerAuth, adminOrOrganizerAuth } from "../../middleware/bearAuth"; // adjust import path to your auth middleware if needed

export const venueRoute = Router();

// Venue Routes

// NEW: Get Venue By Id (PUBLIC, no auth, used by the event details page)
venueRoute.get("/venues/id/:venueId", getPublicVenueByIdController);

// Search by Name
venueRoute.get("/venues/search", anyAuthenticatedUser, searchVenuesController);

// Get All Venues
venueRoute.get('/venues', anyAuthenticatedUser, getAllVenuesController);

// Get Venue By Name
venueRoute.get('/venues/:name', anyAuthenticatedUser, getVenueByNameController);

// Get All Venue details through searching
venueRoute.get('/details/venues/search', adminOrOrganizerAuth, getVenueDetailsController);

// Create a new venue
venueRoute.post("/venues", organizerAuth, createVenueController);

// Update an existing venue
venueRoute.put("/venues/:id", organizerAuth, updateVenueController);

// Delete an existing venue
venueRoute.delete("/venues/:id", organizerAuth, deleteVenueController);