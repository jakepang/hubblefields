import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getSessionUserFromRequest } from "@/lib/auth";
import { canRecordAttendance } from "@/lib/roles";
import { parseAttendancePhoto } from "@/lib/photo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });
  if (!canRecordAttendance(user.role)) {
    return Response.json({ error: "Your role cannot upload attendance photos" }, { status: 403 });
  }

  const payload = (await request.json()) as { dataUrl?: string; localId?: string };
  const photo = parseAttendancePhoto(payload.dataUrl);
  if (!photo) {
    return Response.json({ error: "Invalid photo payload" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "data", "uploads", "attendance");
  await mkdir(dir, { recursive: true });
  const id = `${Date.now()}_${randomBytes(6).toString("hex")}`;
  const filename = `${id}.jpg`;
  await writeFile(path.join(dir, filename), Buffer.from(photo.base64, "base64"));

  const url = `/api/uploads/attendance/${filename}`;
  return Response.json({ url, localId: payload.localId || null }, { status: 201 });
}
