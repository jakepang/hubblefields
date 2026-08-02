import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, projectUsers } from "@/db/schema";
import { createSalt, hashPassword, isStrongPassword } from "@/lib/crypto";
import { requirePlatformAdmin } from "@/lib/platform";

export const runtime = "nodejs";

function makeTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "A1";
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (auth.error) return auth.error;

  const companyId = Number(new URL(request.url).searchParams.get("companyId"));
  if (!Number.isFinite(companyId)) {
    return Response.json({ error: "companyId is required" }, { status: 400 });
  }

  const users = await db
    .select({
      id: projectUsers.id,
      name: projectUsers.name,
      email: projectUsers.email,
      role: projectUsers.role,
      status: projectUsers.status,
      companyId: projectUsers.companyId,
      createdAt: projectUsers.createdAt,
    })
    .from(projectUsers)
    .where(and(eq(projectUsers.companyId, companyId), eq(projectUsers.role, "Project Admin")))
    .orderBy(desc(projectUsers.createdAt));

  return Response.json({ users });
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (auth.error) return auth.error;

  const payload = (await request.json()) as {
    companyId?: number;
    name?: string;
    email?: string;
    temporaryPassword?: string;
  };

  const companyId = Number(payload.companyId);
  const name = payload.name?.trim() || "";
  const email = payload.email?.trim().toLowerCase() || "";
  const temporaryPassword = (payload.temporaryPassword || makeTempPassword()).trim();

  if (!Number.isFinite(companyId)) {
    return Response.json({ error: "companyId is required" }, { status: 400 });
  }
  if (!name || !email.includes("@")) {
    return Response.json({ error: "Valid name and email are required" }, { status: 400 });
  }
  if (!isStrongPassword(temporaryPassword)) {
    return Response.json(
      { error: "Temporary password needs 10+ characters, an uppercase letter and a number" },
      { status: 400 },
    );
  }

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  const existing = await db.select({ id: projectUsers.id }).from(projectUsers).where(eq(projectUsers.email, email)).limit(1);
  if (existing.length) {
    return Response.json({ error: "This email already has an account" }, { status: 409 });
  }

  const now = new Date();
  const salt = createSalt();
  const [user] = await db
    .insert(projectUsers)
    .values({
      name,
      email,
      role: "Project Admin",
      companyId,
      projectCode: company.code,
      status: "Temporary password",
      passwordHash: hashPassword(temporaryPassword, salt),
      passwordSalt: salt.toString("hex"),
      mustChangePassword: true,
      platformAdmin: false,
      credentialExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
    })
    .returning({
      id: projectUsers.id,
      name: projectUsers.name,
      email: projectUsers.email,
      role: projectUsers.role,
      status: projectUsers.status,
      companyId: projectUsers.companyId,
    });

  return Response.json({ user, temporaryPassword }, { status: 201 });
}
