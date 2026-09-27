// Imports
import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { Client }  from "pg"
import * as schema from "./schema"
// Define Client
export const client =new Client({
    connectionString: process.env.DATABASE_URL as string
})
// Establish Connection
const main = async () => {
    await client.connect();
}

// Catch error
main().catch(console.error);

// Initialize Drizzle
const db = drizzle(client,{schema,logger: true});

export default db;