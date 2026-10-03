import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as relations from './relations';

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

// Use DIRECT_URL in development to bypass PgBouncer transaction pooling issues with hot-reloads
const connectionString = process.env.NODE_ENV === 'production' 
  ? process.env.DATABASE_URL! 
  : (process.env.DIRECT_URL || process.env.DATABASE_URL!);

const pool = globalForDb.pool ?? new Pool({
  connectionString,
  max: 20, // Increase max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
