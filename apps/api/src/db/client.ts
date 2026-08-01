import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool, type PoolClient, type QueryResult } from "pg";
import * as schema from "./schema";
import { getTenantContext, getTenantIdOrDefault, hasBridgeAuthContext } from "../tenant/tenant-context.store";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({ connectionString });

const RLS_SETTING = "app.current_tenant_id";
const rawPoolQuery = pool.query.bind(pool);
const wrappedClients = new WeakSet<object>();

function hasTenantContext(): boolean {
  return Boolean(getTenantContext()?.tenantId);
}

async function setSecurityContextOnRawQuery(rawQuery: PoolClient["query"]): Promise<void> {
  if (hasTenantContext()) {
    await rawQuery("select set_config($1, $2, false)", [RLS_SETTING, getTenantIdOrDefault()]);
    return;
  }
  if (hasBridgeAuthContext()) {
    await rawQuery("select set_config($1, $2, false)", ["app.bridge_auth", "on"]);
  }
}

async function clearSecurityContextOnRawQuery(rawQuery: PoolClient["query"]): Promise<void> {
  await rawQuery("select set_config($1, null, false), set_config($2, null, false)", [RLS_SETTING, "app.bridge_auth"]);
}

function wrapClient(client: PoolClient): PoolClient {
  if (wrappedClients.has(client)) {
    return client;
  }
  wrappedClients.add(client);

  const rawQuery = client.query.bind(client);
  const rawRelease = client.release.bind(client);

  // The setting is applied by pool.connect before the client is returned.
  // Keep client.query untouched: wrapping it would recurse because setting the
  // variable itself also requires a query.
  client.release = ((destroy?: boolean | Error) => {
    if (destroy) {
      rawRelease(destroy);
      return;
    }
    // pg.release() is synchronous, so keep the client out of the pool until
    // the connection-local settings are cleared. If reset fails, destroy it
    // instead of returning a potentially cross-tenant connection to the pool.
    void clearSecurityContextOnRawQuery(rawQuery).then(
      () => rawRelease(false),
      () => rawRelease(true),
    );
  }) as PoolClient["release"];

  return client;
}

// Drizzle's node-postgres driver acquires a client for standalone queries and
// for transactions. Set the tenant on that exact connection and clear it
// before release, preventing both cross-tenant leakage and fail-open queries.
// Keep both pg invocation modes: Drizzle uses promises, while operational
// tooling and legacy callers may still use callbacks.
pool.connect = ((...args: unknown[]) => {
  const callback = args[0];
  if (typeof callback === "function") {
    return (Pool.prototype.connect as (...input: unknown[]) => void).call(
      pool,
      (error: Error | undefined, client: PoolClient | undefined, release: (destroy?: boolean | Error) => void) => {
        if (error || !client) {
          callback(error, client, release);
          return;
        }

        const wrapped = wrapClient(client);
        void setSecurityContextOnRawQuery(client.query.bind(client)).then(
          () => callback(undefined, wrapped, wrapped.release),
          (setupError: unknown) => {
            release(true);
            callback(setupError instanceof Error ? setupError : new Error(String(setupError)), undefined, release);
          },
        );
      },
    );
  }

  return (async () => {
    const client = await (Pool.prototype.connect as (...input: unknown[]) => Promise<PoolClient>).call(pool);
    const wrapped = wrapClient(client);
    try {
      await setSecurityContextOnRawQuery(client.query.bind(client));
      return wrapped;
    } catch (error) {
      client.release(true);
      throw error;
    }
  })();
}) as typeof pool.connect;

// Drizzle may use pool.query for simple statements. Route scoped queries
// through a checked-out connection, while preserving callback and Promise
// overloads from node-postgres.
pool.query = ((...args: unknown[]) => {
  const callback = args.at(-1);
  if (!hasTenantContext() && !hasBridgeAuthContext()) {
    return (rawPoolQuery as (...input: unknown[]) => unknown)(...args);
  }

  if (typeof callback === "function") {
    const queryArgs = args.slice(0, -1);
    void (pool.connect as () => Promise<PoolClient>)().then(
      (client) => {
        (client.query as (...input: unknown[]) => unknown)(
          ...queryArgs,
          (error: Error | undefined, result: QueryResult<any>) => {
            client.release(error ?? undefined);
            callback(error, result);
          },
        );
      },
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), undefined),
    );
    return undefined;
  }

  return (async () => {
    const client = await (pool.connect as () => Promise<PoolClient>)();
    try {
      return (await (client.query as (...input: unknown[]) => Promise<QueryResult<any>>)(...args)) as QueryResult<any>;
    } finally {
      client.release();
    }
  })();
}) as typeof pool.query;

export const db = drizzle(pool, { schema });

export async function withTenantTx<T>(work: (tx: typeof db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const tenantId = getTenantIdOrDefault();
    await tx.execute(sql`select set_config('app.current_tenant_id', ${tenantId}, true)`);
    return work(tx as unknown as typeof db);
  });
}

export type DbClient = typeof db;
