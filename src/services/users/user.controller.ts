import { Request, Response } from "express";
import {
 registerUserService,
  deleteUserService,
  getAllUsersService,
  getAllUsersEmailsService,
  getUserByLastNameService,
  getUserById,
  getUserWithDetailsService,
  updateUserService,
  searchUsersWithDetailsService,
} from "./user.service";
import {
  insertUserSchema,
  updateUserSchema,
} from "../../validators/user.1validator";
import { sendNotificationEmail } from "../../middleware/googleMailer";

// Get all users
export const getUsers = async (req: Request, res: Response) => {
  try {
    const allUsers = await getAllUsersService();
    if (!allUsers || allUsers.length === 0) {
      res.status(404).json({ message: "No users found" });
      return;
    }
    res.status(200).json(allUsers);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch users" });
  }
};

// Get user by digitalId
export const getUserByDigitalId = async (req: Request, res: Response) => {
  const digitalId = parseInt(req.params.digitalId as string);
  if (isNaN(digitalId)) {
    res.status(400).json({ error: "Invalid digital ID" });
    return;
  }
  try {
    const user = await getUserById(digitalId);
    if (!user) {
      res.status(404).json({ message: "User not found" }); 
      return;
    }
    res.status(200).json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch user" });
  }
};

// Get user by last name (partial match, case-insensitive)
export const getUserByLastName = async (req: Request, res: Response) => {
  const lastName = req.query.lastName as string;

  if (!lastName) {
    res.status(400).json({ error: "Missing lastName query parameter" });
    return;
  }

  try {
    const users = await getUserByLastNameService(lastName);
    if (!users || users.length === 0) {
      res.status(404).json({ message: "No users found with that last name" });
      return;
    }

    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Error searching users" });
  }
};

// Get full user profile with all related data using digitalId
export const getUserDetails = async (req: Request, res: Response) => {
  const digitalId = parseInt(req.params.digitalId as string);
  if (isNaN(digitalId)) {
    res.status(400).json({ error: "Invalid digital ID" });
     return;
  }

  try {
    const userDetails = await getUserWithDetailsService(digitalId);
    if (!userDetails) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.status(200).json(userDetails);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch user details" });
  }
};

// 🔍 Search all users with details using last name
export const searchUsersWithDetails = async (req: Request, res: Response) => {
  const query = req.query.q as string;

  if (!query) {
     res.status(400).json({ error: "Missing search query parameter" });
     return;
  }

  try {
    const users = await searchUsersWithDetailsService(query);
    if (!users || users.length === 0) {
      res.status(404).json({ message: "No matching users found" });
      return;
    }
    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to search users" });
  }
};

// Create new user (Validated with Zod)
export const createUser = async (req: Request, res: Response) => {
  const validationResult = insertUserSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({ error: validationResult.error.errors.map(e => e.message).join(", ") });
    return;
  }

  try {
    const result = await registerUserService(validationResult.data);
    res.status(201).json({ message: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create user" });
  }
};

// Update user by digitalId (partial update allowed, validated with Zod)
export const updateUser = async (req: Request, res: Response) => {
  const digitalId = parseInt(req.params.digitalId as string);
  if (isNaN(digitalId)) {
   res.status(400).json({ error: "Invalid digital ID" });
    return;
  }

  const validationResult = updateUserSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({ error: validationResult.error.errors.map(e => e.message).join(", ") });
    return;
  }

  if (Object.keys(validationResult.data).length === 0) {
    res.status(400).json({ error: "No valid fields provided for update" });
    return;
  }

  try {
    const result = await updateUserService(digitalId, validationResult.data);
    res.status(200).json({ message: result, updatedFields: validationResult.data });
    return;
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update user" });
    return;
  }
};

// Update user by digitalId (Admin)
export const updateAdminUser = async (req: Request, res: Response) => {
  const digitalId = parseInt(req.params.digitalId as string);
  if (isNaN(digitalId)) {
    res.status(400).json({ error: "Invalid digital ID" });
    return;
  }

  const validationResult = insertUserSchema.partial().safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({ error: validationResult.error.errors.map(e => e.message).join(", ") });
    return;
  }

  try {
    const result = await updateUserService(digitalId, validationResult.data);
    res.status(200).json({ message: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
};

// Delete user by digitalId
export const deleteUser = async (req: Request, res: Response) => {
  const digitalId = parseInt(req.params.digitalId as string);
  if (isNaN(digitalId)) {
    res.status(400).json({ error: "Invalid digital ID" });
    return;
  }

  try {
    const result = await deleteUserService(digitalId);
    res.status(200).json({ message: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete user" });
  }
};

// Broadcast emails to registered users from controller using detailed template with dynamic frontend URL link
export const sendEmailToRegisteredUsersController = async (req: Request, res: Response) => {
  const { subject, htmlContent, message, targetDigitalId, preheader, redirectUrl } = req.body;

  if (!subject || (!htmlContent && !message)) {
    res.status(400).json({ error: "Subject and either htmlContent or message are required" });
    return;
  }

  const frontendUrl = redirectUrl || process.env.FRONTEND_URL || "https://ticketstream-events.netlify.app/dashboard";

  try {
    const recipientList = await getAllUsersEmailsService();
    
    let filteredList = recipientList;
    if (targetDigitalId) {
      filteredList = recipientList.filter(user => user.digitalId === parseInt(targetDigitalId));
    }

    if (!filteredList.length) {
      res.status(404).json({ message: "No registered users found to email." });
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const user of filteredList) {
      if (!user.email) continue;

      const userMessage = message || "We have an important notification regarding your account and upcoming platform activities.";
      const previewText = preheader || subject;

      const detailedTemplate = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0b0b0f; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #e1e1e6;">
          <div style="display: none; font-size: 1px; color: #0b0b0f; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
            ${previewText}
          </div>
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0b0f; padding: 40px 0;">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #141419; border: 1px solid rgba(201, 162, 77, 0.2); border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);">
                  <tr>
                    <td align="center" style="background: linear-gradient(135deg, #181820 0%, #0f0f13 100%); padding: 35px 30px; border-bottom: 2px solid #c9a24d;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #c9a24d; letter-spacing: 1px; text-transform: uppercase;">
                        TicketStream Portal
                      </h1>
                      <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase;">
                        Event Management & Ticketing Suite
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 35px; background-color: #141419;">
                      <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                        Hello ${user.firstName || "Valued User"},
                      </h2>
                      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.7; color: #d1d5db;">
                        ${userMessage}
                      </p>
                      ${
                        htmlContent
                          ? `<div style="margin: 25px 0; padding: 20px; background-color: #1a1a24; border-left: 4px solid #c9a24d; border-radius: 4px; font-size: 14px; line-height: 1.6; color: #f3f4f6;">
                               ${htmlContent}
                             </div>`
                          : ""
                      }
                      <table border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0 10px 0;">
                        <tr>
                          <td align="center" style="border-radius: 6px; background-color: #c9a24d;">
                            <a href="${frontendUrl}" target="_blank" style="font-size: 14px; font-weight: 600; color: #0b0b0f; text-decoration: none; padding: 12px 28px; border-radius: 6px; border: 1px solid #c9a24d; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">
                              Access Dashboard
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                        Best regards,<br>
                        <strong style="color: #ffffff;">TicketStream Administration Team</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="background-color: #0f0f13; padding: 25px 30px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                      <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                        You are receiving this notification because you are a registered member of our platform.
                      </p>
                      <p style="margin: 0; font-size: 11px; color: #4b5563; letter-spacing: 0.5px;">
                        &copy; ${new Date().getFullYear()} TicketStream. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      try {
        const sent = await sendNotificationEmail(
          user.email,
          subject,
          user.firstName,
          userMessage,
          detailedTemplate
        );
        if (sent) successCount++;
        else failureCount++;
      } catch (err) {
        failureCount++;
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    res.status(200).json({
      success: true,
      totalProcessed: filteredList.length,
      successCount,
      failureCount,
      message: "Email broadcast completed successfully with custom frontend link."
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to send notification emails" });
  }
};