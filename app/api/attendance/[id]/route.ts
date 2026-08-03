import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });
  if (!canCorrectAttendance(user.role)) {
    return Response.json({ error: "Only Project Admins can edit punch times" }, { status: 403 });
  }

  const { id: idRaw } = await context.params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid attendance record" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, id))
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Attendance record not found" }, { status: 404 });
  }

  const payload = (await request.json()) as {
    action?: string;
    recordedAt?: string;
    remarks?: string;
  };

  const action =
    payload.action === "OUT"
      ? "OUT"
      : payload.action === "IN"
        ? "IN"
        : existing.action === "OUT"
          ? "OUT"
          : "IN";
  const recordedAt = payload.recordedAt
    ? parseManualRecordedAt(payload.recordedAt)
    : new Date(existing.recordedAt);
  const remarks =
    payload.remarks !== undefined
      ? payload.remarks.trim().slice(0, 300)
      : existing.remarks || "";

  if (!recordedAt) {
    return Response.json({ error: "Enter a valid punch date and time" }, { status: 400 });
  }
  const windowError = validateRecordedAtWindow(recordedAt);
  if (windowError) return Response.json({ error: windowError }, { status: 400 });
  if (!remarks) {
    return Response.json(
      { error: "Enter a reason when correcting a punch (stored in remarks)" },
      { status: 400 },
    );
  }

  const day = localDateString(recordedAt);
  const { start, end } = dayBounds(day, day);
  const dayRows = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.workerId, existing.workerId),
        gte(attendanceRecords.recordedAt, start),
        lt(attendanceRecords.recordedAt, end),
      ),
    )
    .orderBy(asc(attendanceRecords.recordedAt));

  const latestAction = latestActionBefore(dayRows, recordedAt, id);
  if (action === "IN" && latestAction === "IN") {
    return Response.json(
      { error: `${existing.workerName} already has an open check-in at that time` },
      { status: 409 },
    );
  }
  if (action === "OUT" && latestAction !== "IN") {
    return Response.json(
      { error: `${existing.workerName} has no open check-in before that time` },
      { status: 409 },
    );
  }

  const [record] = await db
    .update(attendanceRecords)
    .set({
      action,
      recordedAt,
      remarks,
      // Keep evidence if present; mark location label when editing a field punch without GPS change
      locationLabel:
        existing.source === "manual" || !existing.latitude
          ? "Manual entry"
          : existing.locationLabel,
      source: existing.source === "manual" ? "manual" : existing.source,
    })
    .where(eq(attendanceRecords.id, id))
    .returning();

  return Response.json({ record: mapAttendanceRecord(record, user.name) });
}
