import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { getSessionUserFromRequest } from "@/lib/auth";
import { canManageWorkers } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });
  const rows = await db.select().from(workers).orderBy(asc(workers.name));
  return Response.json({ workers: rows });
}

export async function POST(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });
  if (!canManageWorkers(user.role)) {
    return Response.json({ error: "Your role cannot manage workers" }, { status: 403 });
  }

  const payload = (await request.json()) as {
    workerId?: string;
    name?: string;
    company?: string;
    trade?: string;
  };
  const workerId = payload.workerId?.trim().toUpperCase() || "";
  const name = payload.name?.trim() || "";
  const company = payload.company?.trim() || "";
  const trade = payload.trade?.trim() || "";

  if (!/^[A-Z0-9]{4}$/.test(workerId) || !name || !company || !trade) {
    return Response.json({ error: "Enter the ID last four and complete all worker details" }, { status: 400 });
  }

  try {
    const [worker] = await db
      .insert(workers)
      .values({
        workerId,
        name,
        company,
        trade,
        createdByUserId: user.id,
        createdAt: new Date(),
      })
      .returning();
    return Response.json({ worker }, { status: 201 });
  } catch {
    return Response.json({ error: "Worker ID already exists" }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });
  if (!canManageWorkers(user.role)) {
    return Response.json({ error: "Your role cannot manage workers" }, { status: 403 });
  }

  const payload = (await request.json()) as { id?: number; status?: string };
  if (!payload.id || !new Set(["Active", "Inactive"]).has(payload.status || "")) {
    return Response.json({ error: "Invalid worker update" }, { status: 400 });
  }

  const [worker] = await db
    .update(workers)
    .set({ status: payload.status })
    .where(eq(workers.id, payload.id))
    .returning();

  return Response.json({ worker });
}
