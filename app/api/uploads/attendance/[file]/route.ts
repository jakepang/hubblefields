import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSessionUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ file: string }> }) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });

  const { file } = await context.params;
  if (!/^[a-zA-Z0-9._-]+\.jpe?g$/i.test(file)) {
    return Response.json({ error: "Invalid file" }, { status: 400 });
  }

  try {
    const full = path.join(process.cwd(), "data", "uploads", "attendance", file);
    const buffer = await readFile(full);
    return new Response(buffer, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "private, max-age=86400",
      },
    });
  } catch {
    return Response.json({ error: "File not found" }, { status: 404 });
  }
}
