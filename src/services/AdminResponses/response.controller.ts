import { Request, Response, RequestHandler } from "express";
import { ResponseService } from "../AdminResponses/response.service";

// ✅ Create a new response
export const createResponse: RequestHandler = async (req, res): Promise<void> => {
  try {
    const { ticketId, nationalId, message } = req.body;

    if (!ticketId || !nationalId || !message) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }

    const newResponse = await ResponseService.createResponse({ ticketId, nationalId, message });
    res.status(201).json(newResponse);
  } catch (error) {
    console.error("Create response failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ✅ Update a response
export const updateResponse: RequestHandler = async (req, res): Promise<void> => {
  try {
    const responseId = Number(req.params.id);
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required." });
      return;
    }

    const updated = await ResponseService.updateResponse(responseId, { message });

    if (!updated) {
      res.status(404).json({ error: "Response not found." });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("Update response failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ✅ Delete a response
export const deleteResponse: RequestHandler = async (req, res): Promise<void> => {
  try {
    const responseId = Number(req.params.id);

    const deleted = await ResponseService.deleteResponse(responseId);

    if (!deleted) {
      res.status(404).json({ error: "Response not found." });
      return;
    }

    res.status(200).json({ message: "Response deleted successfully." });
  } catch (error) {
    console.error("Delete response failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ✅ Get all responses for a ticket
export const getResponsesByTicket: RequestHandler = async (req, res): Promise<void> => {
  try {
    const ticketId = Number(req.params.ticketId);

    const allResponses = await ResponseService.getResponsesForTicket(ticketId);
    res.status(200).json(allResponses);
  } catch (error) {
    console.error("Get responses failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
