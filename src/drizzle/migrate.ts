// Geting imports
import "dotenv/config"
import {migrate} from "drizzle-orm/node-postgres/migrator"
import db, { client }from './db'

// Create Migrations
async function migration() {
    console.log('------Migration Started------');
    await migrate(db, {migrationsFolder: __dirname + "/migrations"});
    await client.end();
    console.log(' -------Migration Ended Successfully-------');
    process.exit(0);
}

migration().catch(console.error);