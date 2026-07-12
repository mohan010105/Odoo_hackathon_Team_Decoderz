import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.SUPABASE_DB_HOST) {
  const host = process.env.SUPABASE_DB_HOST;
  const port = process.env.SUPABASE_DB_PORT || "5432";
  const user = process.env.SUPABASE_DB_USER || "postgres";
  const password = process.env.SUPABASE_DB_PASSWORD || "";
  const database = process.env.SUPABASE_DB_NAME || "postgres";
  connectionString = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

if (!connectionString) {
  throw new Error(
    "DATABASE_URL or SUPABASE_DB_HOST must be set. Did you forget to provision a database?",
  );
}

const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
