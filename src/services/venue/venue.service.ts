import { eq, ilike } from "drizzle-orm";
import db from "../../drizzle/db";
import { events, TInsertVenue, TSelectVenue, venues } from "../../drizzle/schema";

// Get All Venues
export const getAllVenueServices = async (): Promise<TSelectVenue[]> =>{

    return await db.query.venues.findMany();

}

// Get Venue by Id
export const getVenueByIdServices = async (venueName:string) :Promise<TSelectVenue | undefined> =>{

    return await db.query.venues.findFirst({
        where: ilike(venues.name,venueName)
    })
}
// search venue by name
export const searchVenuesByName = async (searchTerm: string): Promise<TSelectVenue[]> => {
  return await db.query.venues.findMany({
    where: ilike(venues.name, `%${searchTerm}%`),
  });
};

// get all details related to a Venue
export const getAllDetailsForVenue = async (venueName :string) =>{
  return await db.query.venues.findFirst({
    where: ilike(venues.name, `%${venueName}%`),
    with: {
      events: true
    }
  })
}

// create A new Venue
export const CreateVenueServices = async(venue:TInsertVenue) : Promise<string> =>{
  await db.insert(venues).values(venue).returning();
  return "Venue Created Successfully ✅";
}

// updating An Existing Venue
export const updateVenueServices = async(venueid: number,venue: Partial<TInsertVenue>) : Promise<string> =>{
  await db.update(venues).set(venue).where(eq(venues.venueId, venueid))
 return "Venue Updated succesfully 🔄"
}

// deleting Venue by Id
export const deleteVenueByIdServices = async(venueId: number): Promise<string>=>{
  await db.delete(venues).where(eq(venues.venueId,venueId))
  return "User Deleted SuccessFully ❌";
}