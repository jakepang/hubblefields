import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyProjects } from "@/db/schema";
import { requirePlatformAdmin, slugCode } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (auth.error) return auth.error;

  const companyId = Number(new URL(request.url).searchParams.get("companyId"));
  if (!Number.isFinite(companyId)) {
    return Response.json({ error: "companyId is required" }, { status: 400 });
  }

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  const projects = await db
    .select()
    .from(companyProjects)
    .where(eq(companyProjects.companyId, companyId))
    .orderBy(desc(companyProjects.createdAt));

  return Response.json({ company, projects });
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (auth.error) return auth.error;

  const payload = (await request.json()) as {
    companyId?: number;
    name?: string;
    code?: string;
    address?: string;
    notes?: string;
    status?: string;
  };

  const companyId = Number(payload.companyId);
  const name = payload.name?.trim() || "";
  if (!Number.isFinite(companyId)) return Response.json({ error: "companyId is required" }, { status: 400 });
  if (name.length < 2) return Response.json({ error: "Project name is required" }, { status: 400 });

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  const code = (payload.code?.trim() || slugCode(name)).toUpperCase();

  const [existing] = await db
    .select()
    .from(companyProjects)
    .where(and(eq(companyProjects.companyId, companyId), eq(companyProjects.code, code)))
    .limit(1);
  if (existing) return Response.json({ error: "Project code already exists for this company" }, { status: 409 });

  const [project] = await db
    .insert(companyProjects)
    .values({
      companyId,
      name,
      code,
      status: payload.status?.trim() || "Active",
      address: payload.address?.trim() || null,
      notes: payload.notes?.trim() || null,
      createdAt: new Date(),
    })
    .returning();

  return Response.json({ project }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (auth.error) return auth.error;

  const payload = (await request.json()) as {
    id?: number;
    name?: string;
    status?: string;
    address?: string;
    notes?: string;
  };

  const id = Number(payload.id);
  if (!Number.isFinite(id)) return Response.json({ error: "Project id required" }, { status: 400 });

  const [project] = await db
    .update(companyProjects)
    .set({
      ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
      ...(payload.status?.trim() ? { status: payload.status.trim() } : {}),
      address: payload.address === undefined ? undefined : payload.address.trim() || null,
      notes: payload.notes === undefined ? undefined : payload.notes.trim() || null,
    })
    .where(eq(companyProjects.id, id))
    .returning();

  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  return Response.json({ project });
}
