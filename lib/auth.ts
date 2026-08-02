import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { projectSessions, projectUsers } from "@/db/schema";
import { createSessionToken, sha256 } from "@/lib/crypto";

export const SESSION_COOKIE = "t5_session";
const SESSION_HOURS = 12;

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  platformAdmin: boolean;
};

function shouldUseSecureCookie() {
  // Secure cookies break on http://localhost when running `next start`.
  // Enable only on Vercel/HTTPS deployments, or when explicitly requested.
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.VERCEL === "1";
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: shouldUseSecureCookie(),
  };
}

export async function createSession(userId: number) {
  const token = createSessionToken();
  const now = new Date();
  await db.insert(projectSessions).values({
    userId,
    tokenHash: sha256(token),
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000),
  });
  return token;
}

export async function attachSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(SESSION_HOURS * 3600));
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", cookieOptions(0));
}

/** @deprecated Prefer attachSessionCookie / clearSessionCookie in route handlers */
export function sessionCookieValue(token: string) {
  const secure = shouldUseSecureCookie() ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}${secure}`;
}

/** @deprecated Prefer clearSessionCookie in route handlers */
export function clearSessionCookieValue() {
  const secure = shouldUseSecureCookie() ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function readTokenFromCookieHeader(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}

function isExpired(expiresAt: Date | number | string) {
  const ms = expiresAt instanceof Date ? expiresAt.getTime() : Number(expiresAt);
  return !Number.isFinite(ms) || ms < Date.now();
}

async function userFromToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null;

  const [row] = await db
    .select({
      expiresAt: projectSessions.expiresAt,
      id: projectUsers.id,
      name: projectUsers.name,
      email: projectUsers.email,
      role: projectUsers.role,
      status: projectUsers.status,
      platformAdmin: projectUsers.platformAdmin,
    })
    .from(projectSessions)
    .innerJoin(projectUsers, eq(projectSessions.userId, projectUsers.id))
    .where(eq(projectSessions.tokenHash, sha256(token)))
    .limit(1);

  if (!row || isExpired(row.expiresAt)) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    platformAdmin: Boolean(row.platformAdmin),
  };
}

export async function getSessionUserFromRequest(request?: Request): Promise<AuthUser | null> {
  let token: string | undefined;
  try {
    const jar = await cookies();
    token = jar.get(SESSION_COOKIE)?.value;
  } catch {
    token = undefined;
  }

  if (!token && request) {
    const header = request.headers.get("authorization") || "";
    const bearer = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim();
    token = bearer || readTokenFromCookieHeader(request.headers.get("cookie") || "");
  }

  return userFromToken(token);
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}
