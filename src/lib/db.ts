import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

declare global {
  var __brainclipPool__: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/brainclip";

const pool =
  globalThis.__brainclipPool__ ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__brainclipPool__ = pool;
}

export const db = drizzle(pool, { schema });
