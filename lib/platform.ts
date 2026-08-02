import { getSessionUserFromRequest, type AuthUser } from "@/lib/auth";

export function isPlatformAdmin(user: AuthUser | null | undefined) {
  return Boolean(user?.platformAdmin);
}

export async function requirePlatformAdmin(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return { error: Response.json({ error: "Please sign in again" }, { status: 401 }) };
  if (!isPlatformAdmin(user)) {
    return { error: Response.json({ error: "Platform console access required" }, { status: 403 }) };
  }
  return { user };
}

export function slugCode(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
