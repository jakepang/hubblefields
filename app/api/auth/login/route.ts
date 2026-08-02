import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projectUsers } from "@/db/schema";
import { attachSessionCookie, createSession } from "@/lib/auth";
import { createSalt, hashPassword, isStrongPassword } from "@/lib/crypto";

export const runtime = "nodejs";

function hexToBuffer(hex: string) {
  return Buffer.from(hex, "hex");
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    email?: string;
    password?: string;
    temporaryPassword?: string;
    newPassword?: string;
  };

  const email = payload.email?.trim().toLowerCase() || "";
  const password = payload.password || payload.temporaryPassword || "";
  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  const [user] = await db.select().from(projectUsers).where(eq(projectUsers.email, email)).limit(1);
  if (!user?.passwordHash || !user.passwordSalt) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (user.credentialExpiresAt && user.credentialExpiresAt < new Date() && user.mustChangePassword) {
    return Response.json(
      { error: "Temporary password has expired. Ask the Project Admin to reset it." },
      { status: 410 },
    );
  }

  const valid = hashPassword(password, hexToBuffer(user.passwordSalt)) === user.passwordHash;
  if (!valid) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (!payload.newPassword) {
    if (user.mustChangePassword) {
      return Response.json({
        mustChangePassword: true,
        name: user.name,
        role: user.role,
      });
    }
    const token = await createSession(user.id);
    await attachSessionCookie(token);
    return Response.json({ mustChangePassword: false, name: user.name, role: user.role });
  }

  if (!isStrongPassword(payload.newPassword)) {
    return Response.json(
      { error: "New password needs 10+ characters, an uppercase letter and a number" },
      { status: 400 },
    );
  }

  const nextSalt = createSalt();
  await db
    .update(projectUsers)
    .set({
      passwordHash: hashPassword(payload.newPassword, nextSalt),
      passwordSalt: nextSalt.toString("hex"),
      mustChangePassword: false,
      credentialExpiresAt: null,
      status: "Active",
      activatedAt: new Date(),
    })
    .where(eq(projectUsers.id, user.id));

  const token = await createSession(user.id);
  await attachSessionCookie(token);
  return Response.json({ ok: true, name: user.name, role: user.role });
}
