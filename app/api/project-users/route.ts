import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectUsers } from "@/db/schema";
import { getSessionUserFromRequest } from "@/lib/auth";
import { createSalt, hashPassword, isStrongPassword } from "@/lib/crypto";
import { canManageUsers, INVITE_ROLES } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await getSessionUserFromRequest(request);
  if (!currentUser) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!canManageUsers(currentUser.role)) {
    return Response.json({ error: "Project Admin access required" }, { status: 403 });
  }

  const users = await db
    .select({
      name: projectUsers.name,
      email: projectUsers.email,
      role: projectUsers.role,
      status: projectUsers.status,
    })
    .from(projectUsers)
    .orderBy(desc(projectUsers.createdAt));

  return Response.json({ users });
}

export async function POST(request: Request) {
  const currentUser = await getSessionUserFromRequest(request);
  if (!currentUser) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!canManageUsers(currentUser.role)) {
    return Response.json({ error: "Project Admin access required" }, { status: 403 });
  }

  const payload = (await request.json()) as {
    name?: string;
    email?: string;
    role?: string;
    temporaryPassword?: string;
  };

  const name = payload.name?.trim() || "";
  const email = payload.email?.trim().toLowerCase() || "";
  const role = payload.role?.trim() || "";
  const temporaryPassword = payload.temporaryPassword || "";

  if (!name || !email.includes("@") || !INVITE_ROLES.has(role)) {
    return Response.json({ error: "Valid name, company email and role are required" }, { status: 400 });
  }
  if (!isStrongPassword(temporaryPassword)) {
    return Response.json(
      { error: "Temporary password needs 10+ characters, an uppercase letter and a number" },
      { status: 400 },
    );
  }

  const existing = await db.select({ id: projectUsers.id }).from(projectUsers).where(eq(projectUsers.email, email)).limit(1);
  if (existing.length) {
    return Response.json({ error: "This email already has a project account" }, { status: 409 });
  }

  const now = new Date();
  const salt = createSalt();
  const [user] = await db
    .insert(projectUsers)
    .values({
      name,
      email,
      role,
      status: "Temporary password",
      passwordHash: hashPassword(temporaryPassword, salt),
      passwordSalt: salt.toString("hex"),
      mustChangePassword: true,
      credentialExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
    })
    .returning({
      id: projectUsers.id,
      name: projectUsers.name,
      email: projectUsers.email,
      role: projectUsers.role,
      status: projectUsers.status,
    });

  return Response.json({ user }, { status: 201 });
}

export async function PATCH(request: Request) {
  const currentUser = await getSessionUserFromRequest(request);
  if (!currentUser) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!canManageUsers(currentUser.role)) {
    return Response.json({ error: "Project Admin access required" }, { status: 403 });
  }

  const payload = (await request.json()) as { email?: string; temporaryPassword?: string };
  const email = payload.email?.trim().toLowerCase() || "";
  const temporaryPassword = payload.temporaryPassword || "";

  if (!email.includes("@")) {
    return Response.json({ error: "User email is required" }, { status: 400 });
  }
  if (!isStrongPassword(temporaryPassword)) {
    return Response.json(
      { error: "Temporary password needs 10+ characters, an uppercase letter and a number" },
      { status: 400 },
    );
  }

  const [existing] = await db.select().from(projectUsers).where(eq(projectUsers.email, email)).limit(1);
  if (!existing) return Response.json({ error: "User not found" }, { status: 404 });
  if (existing.role === "Project Admin") {
    return Response.json({ error: "Project Admin passwords cannot be reset here" }, { status: 403 });
  }

  const now = new Date();
  const salt = createSalt();
  const [user] = await db
    .update(projectUsers)
    .set({
      passwordHash: hashPassword(temporaryPassword, salt),
      passwordSalt: salt.toString("hex"),
      mustChangePassword: true,
      credentialExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      status: "Temporary password",
    })
    .where(eq(projectUsers.email, email))
    .returning({
      id: projectUsers.id,
      name: projectUsers.name,
      email: projectUsers.email,
      role: projectUsers.role,
      status: projectUsers.status,
    });

  return Response.json({ user, temporaryPassword });
}
