import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Neon uses HTTP-based postgres, so no persistent connection pool is needed
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

export type Db = typeof db;
