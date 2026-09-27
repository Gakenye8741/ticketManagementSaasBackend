import { Router } from "express";
import { CreateVenue, DeleteVenue, GetAllVenues, getVenueByName, searchVenue, updateVenue, venueDetails } from "./venue.controller";
import { adminAuth, anyAuthenticatedUser } from "../../middleware/bearAuth";


export const venueRoute = Router();

// Venue Routes
// Search by Name
venueRoute.get("/venues/search", searchVenue);

// Get All Venues
venueRoute.get('/venues' ,GetAllVenues)

// Get Venue By Name
venueRoute.get('/venues/:name',anyAuthenticatedUser, getVenueByName)

//Get All Venue details through searching
venueRoute.get('/details/venues/search',adminAuth, venueDetails)

// // Create a new venue
venueRoute.post("/venues",adminAuth, CreateVenue);

// Update an existing venue
venueRoute.put("/venues/:id",adminAuth, updateVenue);

// Delete an existing venue
venueRoute.delete("/venues/:id",adminAuth, DeleteVenue);