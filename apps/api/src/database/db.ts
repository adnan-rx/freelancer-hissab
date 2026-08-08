import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { config } from 'dotenv';

config(); // Load environment variables

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/freelancerhisab';

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { 
  prepare: false, 
  max: 10,
  ssl: 'require',
  connect_timeout: 30
});
export const db = drizzle(client, { schema });
