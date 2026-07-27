import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export async function withTenantTx<T>(work: (tx: typeof db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const tenantId = getTenantIdOrDefault();
    await tx.execute(sql`select set_config('app.current_tenant_id', ${tenantId}, true)`);
    return work(tx as unknown as typeof db);
  });
}

export type DbClient = typeof db;
