import { eq } from "drizzle-orm";
import { hashPin } from "../src/auth/pin-hash";
import { db, pool } from "../src/db/client";
import { superadminUsers } from "../src/db/schema";

async function main() {
  const password = process.argv[2];
  if (!password || password.length < 8) {
    throw new Error("Usage: reset-superadmin.ts <password of 8+ chars>");
  }
  const passwordHash = await hashPin(password);
  const updated = await db
    .update(superadminUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(superadminUsers.username, "superadmin"))
    .returning({ id: superadminUsers.id, username: superadminUsers.username });

  if (updated.length === 0) {
    throw new Error("superadmin user not found");
  }
  console.log("updated", updated[0]);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
