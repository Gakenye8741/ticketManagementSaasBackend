import  db  from "../../drizzle/db"; // adjust to your setup
import { responses } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TInsertResponse } from "../../drizzle/schema";

export class ResponseService {
  // ✅ Create a response
  static async createResponse(data: TInsertResponse) {
    try {
      const response = await db.insert(responses).values(data).returning();
      return response[0];
    } catch (error) {
      console.error("Error creating response:", error);
      throw new Error("Failed to create response.");
    }
  }

  // ✅ Update a response
  static async updateResponse(responseId: number, updatedFields: Partial<TInsertResponse>) {
    try {
      const updated = await db
        .update(responses)
        .set(updatedFields)
        .where(eq(responses.responseId, responseId))
        .returning();
      return updated[0];
    } catch (error) {
      console.error("Error updating response:", error);
      throw new Error("Failed to update response.");
    }
  }

  // ✅ Delete a response
  static async deleteResponse(responseId: number) {
    try {
      const deleted = await db
        .delete(responses)
        .where(eq(responses.responseId, responseId))
        .returning();
      return deleted[0];
    } catch (error) {
      console.error("Error deleting response:", error);
      throw new Error("Failed to delete response.");
    }
  }

  // ✅ Get all responses for a specific ticket
  static async getResponsesForTicket(ticketId: number) {
    try {
      return await db
        .select()
        .from(responses)
        .where(eq(responses.ticketId, ticketId))
        .orderBy(responses.createdAt);
    } catch (error) {
      console.error("Error fetching responses:", error);
      throw new Error("Failed to fetch responses.");
    }
  }
}
