import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projectSessions } from "@/db/schema";
import { clearSessionCookie, getSessionUserFromRequest, SESSION_COOKIE } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUserFromRequest(request);
  const cookie = request.headers.get("cookie") || "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  if (token) {
    await db.delete(projectSessions).where(eq(projectSessions.tokenHash, sha256(token)));
  } else if (user) {
    // Session resolved via Next cookies() but header parse missed it; still clear cookie below.
  }

  await clearSessionCookie();
  return Response.json({ ok: true });
}
