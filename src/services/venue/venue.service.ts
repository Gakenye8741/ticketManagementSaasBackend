import { eq, ilike, and } from "drizzle-orm";
import db from "../../drizzle/db";
import { events, TInsertVenue, TSelectVenue, venues } from "../../drizzle/schema";

// Get All Venues (Scoped to organizer)
export const getAllVenueServices = async (orgId: number): Promise<TSelectVenue[]> =>{
    return await db.query.venues.findMany({
        where: eq(venues.orgId, orgId)
    });
}

// Get Venue by Id (Scoped to organizer)
export const getVenueByIdServices = async (venueName: string, orgId: number) :Promise<TSelectVenue | undefined> =>{
    return await db.query.venues.findFirst({
        where: and(ilike(venues.name, venueName), eq(venues.orgId, orgId))
    })
}

// search venue by name (Scoped to organizer)
export const searchVenuesByName = async (searchTerm: string, orgId: number): Promise<TSelectVenue[]> => {
  return await db.query.venues.findMany({
    where: and(ilike(venues.name, `%${searchTerm}%`), eq(venues.orgId, orgId)),
  });
};



export const getVenueDetailsByNameService = async (venueName: string, orgId: number) => {
  // 1. Explicitly type the result using TSelectVenue to prevent TS7022 inference errors
  const venueList: TSelectVenue[] = await db
    .select()
    .from(venues)
    .where(and(eq(venues.name, venueName), eq(venues.orgId, orgId)));

  // Guard against empty results before accessing index 0
  if (!venueList || venueList.length === 0) {
    throw new Error("Venue not found");
  }

  const venue = venueList[0];

  // 2. Query events safely after the venue has been confirmed
  const venueEvents = await db
    .select()
    .from(events)
    .where(eq(events.venueId, venue.venueId));

  return {
    ...venue,
    events: venueEvents,
  };
};

// create A new Venue (Automatically binds to the creator's orgId)
export const CreateVenueServices = async(venue: TInsertVenue) : Promise<string> =>{
  await db.insert(venues).values(venue).returning();
  return "Venue Created Successfully ✅";
}

// updating An Existing Venue (Scoped to organizer)
export const updateVenueServices = async(venueid: number, venue: Partial<TInsertVenue>, orgId: number) : Promise<string> =>{
  await db.update(venues)
    .set(venue)
    .where(and(eq(venues.venueId, venueid), eq(venues.orgId, orgId)));
  return "Venue Updated succesfully 🔄"
}

// deleting Venue by Id (Scoped to organizer)
export const deleteVenueByIdServices = async(venueId: number, orgId: number): Promise<string>=>{
  await db.delete(venues)
    .where(and(eq(venues.venueId, venueId), eq(venues.orgId, orgId)));
  return "User Deleted SuccessFully ❌";
}

// Get Venue by Id (PUBLIC: for attendees viewing an event page, not scoped to an organizer)
export const getPublicVenueByIdService = async (venueId: number) => {
  const [venue] = await db
    .select({
      venueId: venues.venueId,
      name: venues.name,
      
      address: venues.address,
      capacity: venues.capacity,
      
    })
    .from(venues)
    .where(eq(venues.venueId, venueId))
    .limit(1);

  return venue; // undefined if not found
};