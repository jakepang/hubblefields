import { and, asc, gte, lt, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, projectUsers, workers } from "@/db/schema";
import {
  buildOnsiteRoster,
  dayBounds,
  daysBetween,
  pairShifts,
} from "@/lib/attendance";
import { mapAttendanceRecord } from "@/lib/attendance-map";
import { getSessionUserFromRequest } from "@/lib/auth";
import { checkLocation, publicGeofence } from "@/lib/geofence";
import { parseAttendancePhoto, parseAttendancePhotoUrl } from "@/lib/photo";
import { canBrowseAttendanceHistory, canRecordAttendance, canViewReports } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to") || from;
  const hasRange = Boolean(from || url.searchParams.get("to"));

  if (hasRange) {
    if (!canBrowseAttendanceHistory(user.role)) {
      return Response.json({ error: "Attendance history is restricted" }, { status: 403 });
    }
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return Response.json({ error: "Invalid date range" }, { status: 400 });
    }
    if (to < from) {
      return Response.json({ error: "End date must be on or after start date" }, { status: 400 });
    }
    const span = daysBetween(from, to);
    const maxDays = canViewReports(user.role) ? 92 : 14;
    if (span > maxDays) {
      return Response.json({ error: `Date range cannot exceed ${maxDays} days` }, { status: 400 });
    }
  }

  const { start, end } = dayBounds(from, to);
  const rows = await db
    .select({
      record: attendanceRecords,
      recordedByName: projectUsers.name,
    })
    .from(attendanceRecords)
    .leftJoin(projectUsers, eq(attendanceRecords.recordedByUserId, projectUsers.id))
    .where(and(gte(attendanceRecords.recordedAt, start), lt(attendanceRecords.recordedAt, end)))
    .orderBy(asc(attendanceRecords.recordedAt));

  const today = dayBounds();
  const todayRows =
    start.getTime() === today.start.getTime() && end.getTime() === today.end.getTime()
      ? rows.map((row) => row.record)
      : (
          await db
            .select()
            .from(attendanceRecords)
            .where(and(gte(attendanceRecords.recordedAt, today.start), lt(attendanceRecords.recordedAt, today.end)))
            .orderBy(asc(attendanceRecords.recordedAt))
        );

  const onsiteNow = buildOnsiteRoster(todayRows);
  const shifts = pairShifts(rows.map(({ record }) => record));
  const closedHours = shifts.filter((shift) => shift.hours != null).map((shift) => shift.hours as number);
  const totalHours = closedHours.reduce((sum, hours) => sum + hours, 0);

  return Response.json({
    records: rows
      .slice()
      .reverse()
      .map(({ record, recordedByName }) => mapAttendanceRecord(record, recordedByName)),
    stats: {
      checkedIn: rows.filter(({ record }) => record.action === "IN").length,
      checkedOut: rows.filter(({ record }) => record.action === "OUT").length,
      onsite: onsiteNow.length,
      totalHours: Math.round(totalHours * 100) / 100,
      openShifts: shifts.filter((shift) => shift.open).length,
    },
    onsiteNow,
    shifts,
    geofence: publicGeofence(),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });
  if (!canRecordAttendance(user.role)) {
    return Response.json({ error: "Your role cannot record attendance" }, { status: 403 });
  }

  const payload = (await request.json()) as {
    workerId?: string;
    action?: string;
    remarks?: string;
    photoDataUrl?: string;
    photoUrl?: string;
    latitude?: number;
    longitude?: number;
    accuracyM?: number;
    clientLocalId?: string;
  };

  const workerId = payload.workerId?.trim().toUpperCase() || "";
  const action = payload.action === "OUT" ? "OUT" : payload.action === "IN" ? "IN" : "";
  if (!workerId || !action) {
    return Response.json({ error: "Select a worker" }, { status: 400 });
  }

  const photoUrl = parseAttendancePhotoUrl(payload.photoUrl);
  const photo = photoUrl ? null : parseAttendancePhoto(payload.photoDataUrl);
  if (!photoUrl && !photo) {
    return Response.json({ error: "Capture a clear site photo before submitting" }, { status: 400 });
  }

  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return Response.json({ error: "Enable location services and try again" }, { status: 400 });
  }

  const accuracyM =
    payload.accuracyM === undefined || payload.accuracyM === null
      ? null
      : Number(payload.accuracyM);
  const location = checkLocation(
    latitude,
    longitude,
    Number.isFinite(accuracyM as number) ? (accuracyM as number) : null,
  );
  const config = publicGeofence();
  if (config.strict && !location.inside) {
    return Response.json(
      {
        error: `Outside ${location.label} geofence (${location.distanceM}m away; allowed ${location.radiusM}m)`,
        location,
      },
      { status: 403 },
    );
  }

  const [worker] = await db.select().from(workers).where(eq(workers.workerId, workerId)).limit(1);
  if (!worker || worker.status !== "Active") {
    return Response.json({ error: "Select an active worker from the manpower list" }, { status: 400 });
  }

  const { start, end } = dayBounds();
  const todayRows = await db
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
  const latestAction = todayRows.length ? todayRows[todayRows.length - 1].action : null;
  if (action === "IN" && latestAction === "IN") {
    return Response.json({ error: `${worker.name} is already checked in today` }, { status: 409 });
  }
  if (action === "OUT" && latestAction !== "IN") {
    return Response.json({ error: `${worker.name} is not currently onsite` }, { status: 409 });
  }

  const [record] = await db
    .insert(attendanceRecords)
    .values({
      workerId,
      workerName: worker.name,
      company: worker.company,
      trade: worker.trade,
      action,
      remarks: payload.remarks?.trim().slice(0, 300) || null,
      photoData: photo?.dataUrl || null,
      photoUrl,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyM: location.accuracyM,
      locationVerified: location.inside,
      locationLabel: location.label,
      distanceM: location.distanceM,
      recordedByUserId: user.id,
      recordedAt: new Date(),
      source: "field",
    })
    .returning();

  return Response.json(
    {
      record: mapAttendanceRecord(record, user.name),
      location,
      clientLocalId: payload.clientLocalId || null,
    },
    { status: 201 },
  );
}
