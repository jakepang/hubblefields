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

  const manpower = [
    { workerId: "673X", name: "AHMED IKBAL", company: "T5 Substructure", trade: "RIGGER & SIGNAL" },
    { workerId: "925N", name: "ASHAD MOHAMMED", company: "T5 Substructure", trade: "WELDER" },
    { workerId: "424W", name: "JEYARAJ RAJA", company: "T5 Substructure", trade: "RIGGER & SIGNAL" },
    { workerId: "684J", name: "MURUGAVEL SEKAR", company: "T5 Substructure", trade: "RIGGER & SIGNAL" },
    { workerId: "412X", name: "RAHMAN MOHAMMAD ANISUR", company: "T5 Substructure", trade: "RIGGER & SIGNAL" },
    { workerId: "329R", name: "HOSSAIN SHISHIR", company: "T5 Substructure", trade: "RIGGER & SIGNAL" },
    { workerId: "252L", name: "MOROL SAGOR", company: "T5 Substructure", trade: "RIGGER & SIGNAL" },
    { workerId: "059B", name: "JOHARI BIN JAMIL", company: "T5 Substructure", trade: "CRAWLER CRANE OPERATOR" },
    { workerId: "681K", name: "ALI FOROZ", company: "T5 Substructure", trade: "WELDER" },
    { workerId: "622T", name: "OR RASHID HARUN", company: "T5 Substructure", trade: "RIGGER & SIGNAL" },
    { workerId: "592R", name: "RAZZAQUE ABDUR", company: "T5 Substructure", trade: "BORED PILING OPERATOR" },
    { workerId: "822U", name: "ISLAM ZAHIRUL", company: "T5 Substructure", trade: "LIFTING SUPERVISOR" },
    { workerId: "168W", name: "ALI MOHAMMAD YOUNUS", company: "T5 Substructure", trade: "BORED PILING OPERATOR" },
    { workerId: "949Q", name: "MILON RUHUL AMIN", company: "T5 Substructure", trade: "LIFTING SUPERVISOR" },
    { workerId: "033K", name: "MANIMUTHU RAJENDRAN", company: "T5 Substructure", trade: "SITE SUPERVISOR" },
    { workerId: "869P", name: "NATARAJAN PRABAKARAN", company: "T5 Substructure", trade: "SITE SUPERVISOR" },
  ];

  const now = new Date();
  const adminEmail = "admin@t5.local";
  const adminPassword = "Admin12345!";

  const [existingAdmin] = await db
    .select()
    .from(schema.projectUsers)
    .where(eq(schema.projectUsers.email, adminEmail))
    .limit(1);

  let adminId = existingAdmin?.id;
  if (!existingAdmin) {
    const salt = createSalt();
    const [admin] = await db
      .insert(schema.projectUsers)
      .values({
        name: "Project Admin",
        email: adminEmail,
        role: "Project Admin",
        status: "Temporary password",
        passwordHash: hashPassword(adminPassword, salt),
        passwordSalt: salt.toString("hex"),
        mustChangePassword: true,
        platformAdmin: true,
        credentialExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
      })
      .returning();
    adminId = admin.id;
    console.log(`Seeded admin ${adminEmail} / ${adminPassword} (must change on first login)`);
  } else {
    await db
      .update(schema.projectUsers)
      .set({ platformAdmin: true })
      .where(eq(schema.projectUsers.id, existingAdmin.id));
    console.log(`Admin already exists: ${adminEmail} (platform console enabled)`);
  }

  if (!adminId) throw new Error("Missing admin id");

  const companyName = "QI SHENG CONSTRUCTION PTE. LTD.";
  const companyCode = "QI-SHENG";
  const [existingCompany] = await db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.code, companyCode))
    .limit(1);

  let companyId = existingCompany?.id;
  if (!existingCompany) {
    const [company] = await db
      .insert(schema.companies)
      .values({
        name: companyName,
        code: companyCode,
        status: "Active",
        notes: "Field trial customer — multi-site Singapore",
        createdAt: now,
      })
      .returning();
    companyId = company.id;
    console.log(`Seeded company ${companyName}`);
  } else {
    console.log(`Company already exists: ${companyName}`);
  }

  if (companyId) {
    const [existingProject] = await db
      .select()
      .from(schema.companyProjects)
      .where(eq(schema.companyProjects.companyId, companyId))
      .limit(1);
    if (!existingProject) {
      await db.insert(schema.companyProjects).values({
        companyId,
        name: "Singapore Operations",
        code: "SG-OPS",
        status: "Active",
        address: "Singapore",
        notes: "Dispersed sites — company-level attendance",
        createdAt: now,
      });
      console.log("Seeded default project Singapore Operations");
    }

    await db
      .update(schema.projectUsers)
      .set({ companyId, projectCode: companyCode })
      .where(eq(schema.projectUsers.id, adminId));
  }

  const seedManpower = process.env.SEED_MANPOWER !== "0" && process.env.SEED_MANPOWER !== "false";
  if (!seedManpower) {
    console.log("Skipping manpower seed (SEED_MANPOWER=0). Add workers in the app.");
    return;
  }

  for (const worker of manpower) {
    const [existing] = await db
      .select()
      .from(schema.workers)
      .where(eq(schema.workers.workerId, worker.workerId))
      .limit(1);
    if (existing) continue;
    await db.insert(schema.workers).values({
      ...worker,
      status: "Active",
      createdByUserId: adminId,
      createdAt: now,
    });
  }

  console.log(`Seeded ${manpower.length} workers`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
