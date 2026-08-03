import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, workers } from "@/db/schema";
import { dayBounds, localDateString } from "@/lib/attendance";
import {
  latestActionBefore,
  mapAttendanceRecord,
  parseManualRecordedAt,
} from "@/lib/attendance-map";
import { getSessionUserFromRequest } from "@/lib/auth";
import { canCorrectAttendance } from "@/lib/roles";

export const runtime = "nodejs";

const MAX_LOOKBACK_DAYS = 92;
const FUTURE_SLACK_MS = 5 * 60 * 1000;

function validateRecordedAtWindow(recordedAt: Date) {
  const now = Date.now();
  if (recordedAt.getTime() > now + FUTURE_SLACK_MS) {
    return "Punch time cannot be in the future";
  }
  const earliest = new Date();
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() - MAX_LOOKBACK_DAYS);
  if (recordedAt.getTime() < earliest.getTime()) {
    return `Punch time cannot be more than ${MAX_LOOKBACK_DAYS} days ago`;
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });
  if (!canCorrectAttendance(user.role)) {
    return Response.json({ error: "Only Project Admins can add manual punches" }, { status: 403 });
  }

  const payload = (await request.json()) as {
    workerId?: string;
    action?: string;
    recordedAt?: string;
    remarks?: string;
  };

  const workerId = payload.workerId?.trim().toUpperCase() || "";
  const action = payload.action === "OUT" ? "OUT" : payload.action === "IN" ? "IN" : "";
  const remarks = payload.remarks?.trim().slice(0, 300) || "";
  const recordedAt = parseManualRecordedAt(payload.recordedAt);

  if (!workerId || !action) {
    return Response.json({ error: "Select a worker and action" }, { status: 400 });
  }
  if (!remarks) {
    return Response.json({ error: "Enter a reason for this manual punch" }, { status: 400 });
  }
  if (!recordedAt) {
    return Response.json({ error: "Enter a valid punch date and time" }, { status: 400 });
  }
  const windowError = validateRecordedAtWindow(recordedAt);
  if (windowError) return Response.json({ error: windowError }, { status: 400 });

  const [worker] = await db.select().from(workers).where(eq(workers.workerId, workerId)).limit(1);
  if (!worker) {
    return Response.json({ error: "Worker not found in manpower list" }, { status: 400 });
  }

  const day = localDateString(recordedAt);
  const { start, end } = dayBounds(day, day);
  const dayRows = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.workerId, workerId),
        gte(attendanceRecords.recordedAt, start),
        lt(attendanceRecords.recordedAt, end),
      ),
    )
    .orderBy(asc(attendanceRecords.recordedAt));

  const latestAction = latestActionBefore(dayRows, recordedAt);
  if (action === "IN" && latestAction === "IN") {
    return Response.json(
      { error: `${worker.name} already has an open check-in at that time` },
      { status: 409 },
    );
  }
  if (action === "OUT" && latestAction !== "IN") {
    return Response.json(
      { error: `${worker.name} has no open check-in before that time` },
      { status: 409 },
    );
  }

  const [record] = await db
    .insert(attendanceRecords)
    .values({
      workerId,
      workerName: worker.name,
      company: worker.company,
      trade: worker.trade,
      action,
      remarks,
      photoData: null,
      photoUrl: null,
      latitude: null,
      longitude: null,
      accuracyM: null,
      locationVerified: null,
      locationLabel: "Manual entry",
      distanceM: null,
      recordedByUserId: user.id,
      recordedAt,
      source: "manual",
    })
    .returning();

  return Response.json({ record: mapAttendanceRecord(record, user.name) }, { status: 201 });
}
