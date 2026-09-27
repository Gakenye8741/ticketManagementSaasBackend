# 🎫 Event & Ticketing Management System - Backend

This is the backend service for an Event & Ticketing Management System built with **TypeScript**, **Express**, **Drizzle ORM**, **JWT**, **Nodemailer**, and **Node.js**. It powers user authentication, event creation, ticket purchasing, and email notifications.

---

## 📦 Features

- ✅ User Authentication with JWT
- 🧾 Secure Password Hashing with Bcrypt
- 🧑‍💼 Role-based Access (User, Organizer, Admin)
- 🎟️ Event and Ticket Management
- 📤 Email Notifications (via Nodemailer)
- 🧠 Type-safe Database Layer using Drizzle ORM
- 🗂️ Scalable Express API structure
- ⚙️ Environment-based configuration

---

## 🧠 What Happens Behind the Scenes

1. **Authentication:**
   - Users sign up and log in with credentials.
   - Passwords are hashed securely using Bcrypt.
   - A **JWT token** is issued on login for protected access.

2. **Event Management:**
   - Organizers can create, update, and delete events.
   - Events include details such as name, location, capacity, and schedule.

3. **Ticket Booking:**
   - Users can browse events and purchase tickets.
   - Ticket data is saved and (optionally) a QR code is generated.
   - A **confirmation email** is sent to the user.

4. **Email Notifications:**
   - Sent via **Nodemailer** on key actions (registration, booking, etc.).

5. **Secure Access:**
   - JWT middleware protects routes.
   - Role-based access control separates users, organizers, and admins.

6. **Database Layer:**
   - **Drizzle ORM** manages schema and type-safe queries.
   - Supports PostgreSQL, MySQL, or SQLite depending on your `.env`.

---

## 🛠️ Tech Stack

| Layer       | Tech                              |
|-------------|-----------------------------------|
| Language    | TypeScript                        |
| Runtime     | Node.js                           |
| Server      | Express.js                        |
| ORM         | Drizzle ORM                       |
| Database    | PostgreSQL / MySQL / SQLite       |
| Auth        | JWT + bcrypt                      |
| Mailer      | Nodemailer                        |
| Config      | dotenv                            |

---

## 📁 Project Structure

src/
├── config/ # DB and mail configurations
├── controllers/ # Route handlers
├── middlewares/ # Auth and error middlewares
├── models/ # Drizzle ORM schemas
├── routes/ # API route definitions
├── services/ # Business logic
├── utils/ # Helper functions
├── app.ts # Express app setup
└── index.ts # Server entry point

yaml
Copy
Edit

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/event-ticketing-backend.git
cd event-ticketing-backend
2. Install Dependencies
bash
Copy
Edit
npm install
3. Setup Environment Variables
Create a .env file in the root directory with the following values:

env
Copy
Edit
PORT=5000
DATABASE_URL=postgres://user:password@localhost:5432/yourdb
JWT_SECRET=your_jwt_secret
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
4. Setup Drizzle ORM
Generate and push your schema:

bash
Copy
Edit
npx drizzle-kit generate
npx drizzle-kit push
5. Start the Development Server
bash
Copy
Edit
npm run dev
