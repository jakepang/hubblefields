import type { attendanceRecords } from "@/db/schema";

export function mapAttendanceRecord(
  row: typeof attendanceRecords.$inferSelect,
  recordedByName: string | null,
) {
  return {
    id: row.id,
    workerId: row.workerId,
    workerName: row.workerName,
    company: row.company,
    trade: row.trade,
    action: row.action,
    remarks: row.remarks,
    source: row.source || "field",
    hasPhoto: Boolean(row.photoUrl || row.photoData),
    photoUrl: row.photoUrl || (row.photoData ? `/api/attendance/${row.id}/photo` : null),
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyM: row.accuracyM,
    locationVerified: row.locationVerified,
    locationLabel: row.locationLabel,
    distanceM: row.distanceM,
    recordedByUserId: row.recordedByUserId,
    recordedByName: recordedByName || "Unknown",
    recordedAt: row.recordedAt,
  };
}

export function parseManualRecordedAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Latest action for a worker on the calendar day of `at`, optionally ignoring one record id. */
export function latestActionBefore(
  rows: Array<{ id: number; action: string; recordedAt: Date | string }>,
  at: Date,
  excludeId?: number,
) {
  const atMs = at.getTime();
  const prior = rows
    .filter((row) => row.id !== excludeId && new Date(row.recordedAt).getTime() <= atMs)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  return prior.length ? prior[prior.length - 1].action : null;
}
