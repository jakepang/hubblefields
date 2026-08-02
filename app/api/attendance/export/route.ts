import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, projectUsers } from "@/db/schema";
import { dayBounds, pairShifts } from "@/lib/attendance";
import { getSessionUserFromRequest } from "@/lib/auth";
import { canViewReports } from "@/lib/roles";

export const runtime = "nodejs";

function csvValue(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });
  if (!canViewReports(user.role)) {
    return Response.json({ error: "Reports are restricted to Project Admins" }, { status: 403 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return Response.json({ error: "Invalid report dates" }, { status: 400 });
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

  const records = rows.map(({ record }) => record);
  const shifts = pairShifts(records);
  const shiftHoursByOutKey = new Map<string, number | null>();
  for (const shift of shifts) {
    if (shift.checkedOutAt) {
      shiftHoursByOutKey.set(`${shift.workerId}|${shift.checkedOutAt}`, shift.hours);
    }
  }

  const movementRows = [
    [
      "Date",
      "Time",
      "Worker",
      "ID (last 4)",
      "Company",
      "Trade",
      "Event",
      "Remarks",
      "Recorded by",
      "Latitude",
      "Longitude",
      "Accuracy (m)",
      "Distance (m)",
      "Geofence OK",
      "Location label",
      "Has photo",
      "Shift hours",
    ],
    ...rows.map(({ record, recordedByName }) => {
      const date = new Date(record.recordedAt);
      const iso = date.toISOString();
      const hours =
        record.action === "OUT"
          ? shiftHoursByOutKey.get(`${record.workerId}|${iso}`)
          : null;
      return [
        date.toLocaleDateString("en-SG"),
        date.toLocaleTimeString("en-SG"),
        record.workerName,
        record.workerId.slice(-4),
        record.company,
        record.trade,
        record.action === "IN" ? "Check In" : "Check Out",
        record.remarks || "",
        recordedByName || "Unknown",
        record.latitude != null ? String(record.latitude) : "",
        record.longitude != null ? String(record.longitude) : "",
        record.accuracyM != null ? String(Math.round(record.accuracyM)) : "",
        record.distanceM != null ? String(Math.round(record.distanceM)) : "",
        record.locationVerified == null ? "" : record.locationVerified ? "Yes" : "No",
        record.locationLabel || "",
        record.photoData ? "Yes" : "No",
        hours != null ? String(hours) : "",
      ];
    }),
  ];

  const shiftRows = [
    [],
    ["Shifts"],
    ["Worker", "ID (last 4)", "Company", "Trade", "Check in", "Check out", "Hours", "Status"],
    ...shifts.map((shift) => [
      shift.workerName,
      shift.workerId.slice(-4),
      shift.company,
      shift.trade,
      new Date(shift.checkedInAt).toLocaleString("en-SG"),
      shift.checkedOutAt ? new Date(shift.checkedOutAt).toLocaleString("en-SG") : "",
      shift.hours != null ? String(shift.hours) : "",
      shift.open ? "Still onsite" : "Closed",
    ]),
  ];

  const csv = [...movementRows, ...shiftRows].map((row) => row.map(csvValue).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="T5-attendance-${from}-to-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
