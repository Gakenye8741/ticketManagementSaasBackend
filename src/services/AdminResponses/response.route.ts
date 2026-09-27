
import { Router } from "express";
import {
  createResponse,
  updateResponse,
  deleteResponse,
  getResponsesByTicket,
} from "../AdminResponses/response.controller";

const responseRoute = Router();

responseRoute.post("/responses", createResponse);
responseRoute.put("/responses/:id", updateResponse);
responseRoute.delete("/responses/:id", deleteResponse);
responseRoute.get("/responses/ticket/:ticketId", getResponsesByTicket);

export default responseRoute;
