import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyProjects } from "@/db/schema";
import { requirePlatformAdmin, slugCode } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (auth.error) return auth.error;

  const rows = await db.select().from(companies).orderBy(desc(companies.createdAt));
  const projects = await db.select().from(companyProjects);
  const projectCount = new Map<number, number>();
  for (const project of projects) {
    projectCount.set(project.companyId, (projectCount.get(project.companyId) || 0) + 1);
  }

  return Response.json({
    companies: rows.map((row) => ({
      ...row,
      projectCount: projectCount.get(row.id) || 0,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (auth.error) return auth.error;

  const payload = (await request.json()) as {
    name?: string;
    code?: string;
    contactName?: string;
    contactEmail?: string;
    notes?: string;
    status?: string;
  };

  const name = payload.name?.trim() || "";
  if (name.length < 2) {
    return Response.json({ error: "Company name is required" }, { status: 400 });
  }

  const code = (payload.code?.trim() || slugCode(name)).toUpperCase();
  if (!code) return Response.json({ error: "Company code is required" }, { status: 400 });

  try {
    const [company] = await db
      .insert(companies)
      .values({
        name,
        code,
        status: payload.status?.trim() || "Active",
        contactName: payload.contactName?.trim() || null,
        contactEmail: payload.contactEmail?.trim() || null,
        notes: payload.notes?.trim() || null,
        createdAt: new Date(),
      })
      .returning();
    return Response.json({ company: { ...company, projectCount: 0 } }, { status: 201 });
  } catch {
    return Response.json({ error: "Company code already exists" }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (auth.error) return auth.error;

  const payload = (await request.json()) as {
    id?: number;
    name?: string;
    status?: string;
    contactName?: string;
    contactEmail?: string;
    notes?: string;
  };

  const id = Number(payload.id);
  if (!Number.isFinite(id)) return Response.json({ error: "Company id required" }, { status: 400 });

  const [company] = await db
    .update(companies)
    .set({
      ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
      ...(payload.status?.trim() ? { status: payload.status.trim() } : {}),
      contactName: payload.contactName === undefined ? undefined : payload.contactName.trim() || null,
      contactEmail: payload.contactEmail === undefined ? undefined : payload.contactEmail.trim() || null,
      notes: payload.notes === undefined ? undefined : payload.notes.trim() || null,
    })
    .where(eq(companies.id, id))
    .returning();

  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });
  return Response.json({ company });
}
