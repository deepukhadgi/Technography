#!/usr/bin/env node

import { getPool } from "./lib/db.js";

async function cleanupExpiredSessions() {
  try {
    const pool = getPool();
    const result = await pool.query(
      "DELETE FROM sessions WHERE last_activity_at <= now() - INTERVAL '30 minutes'"
    );
    console.log(`Cleaned up ${result.rowCount} idle sessions`);
  } catch (error) {
    console.error("Failed to cleanup idle sessions:", error);
  }
}

if (require.main === module) {
  cleanupExpiredSessions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { cleanupExpiredSessions };