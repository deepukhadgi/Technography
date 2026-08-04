import { Pool } from "pg";

const globalForPg = globalThis as unknown as { tgPool?: Pool };

/** Lazily-created shared Postgres pool (singleton across HMR in dev). */
export function getPool(): Pool {
  if (!globalForPg.tgPool) {
    globalForPg.tgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForPg.tgPool;
}
