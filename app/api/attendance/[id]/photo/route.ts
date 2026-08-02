import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
import { getSessionUserFromRequest } from "@/lib/auth";
import { photoBufferFromDataUrl } from "@/lib/photo";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });

  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid record" }, { status: 400 });
  }

  const [row] = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, id)).limit(1);
  if (!row) return Response.json({ error: "No photo for this record" }, { status: 404 });

  if (row.photoUrl) {
    if (row.photoUrl.startsWith("/api/uploads/")) {
      return Response.redirect(new URL(row.photoUrl, request.url), 302);
    }
    return Response.redirect(row.photoUrl, 302);
  }

  if (!row.photoData) {
    return Response.json({ error: "No photo for this record" }, { status: 404 });
  }

  const parsed = photoBufferFromDataUrl(row.photoData);
  if (!parsed) {
    return Response.json({ error: "Photo is unreadable" }, { status: 500 });
  }

  return new Response(new Uint8Array(parsed.buffer), {
    headers: {
      "content-type": parsed.mime,
      "cache-control": "private, max-age=3600",
    },
  });
}
