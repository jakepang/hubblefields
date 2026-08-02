import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import fs from "node:fs";
import path from "node:path";
import * as schema from "../db/schema";
import { createSalt, hashPassword } from "../lib/crypto";

function resolveUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "t5.sqlite"));
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return `file:${dbPath}`;
}

async function main() {
  const client = createClient({
    url: resolveUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  const adminEmail = process.env.ADMIN_EMAIL || "admin@t5.local";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "Admin12345!";
  const now = new Date();

  const [admin] = await db
    .select()
    .from(schema.projectUsers)
    .where(eq(schema.projectUsers.email, adminEmail))
    .limit(1);

  if (!admin) {
    throw new Error(`Admin not found: ${adminEmail}. Run npm run db:seed first.`);
  }

  const salt = createSalt();
  await db
    .update(schema.projectUsers)
    .set({
      passwordHash: hashPassword(adminPassword, salt),
      passwordSalt: salt.toString("hex"),
      mustChangePassword: true,
      status: "Temporary password",
      credentialExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    })
    .where(eq(schema.projectUsers.id, admin.id));

  console.log(`Reset admin temporary password:`);
  console.log(`  Email:    ${adminEmail}`);
  console.log(`  Password: ${adminPassword}`);
  console.log(`Must change password on next login.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
