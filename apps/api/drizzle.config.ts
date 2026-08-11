import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/freelancerhisab',
  },
  verbose: true,
  strict: true,
});
// DATABASE_URL=postgresql://neondb_owner:npg_mwxc9bFgLp4d@ep-frosty-cell-auy8i04i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
