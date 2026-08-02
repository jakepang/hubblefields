export function dayBounds(from?: string | null, to?: string | null) {
  const start = from ? new Date(`${from}T00:00:00`) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(`${to}T00:00:00`) : new Date(start);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

export type Movement = {
  workerId: string;
  workerName: string;
  company: string;
  trade: string;
  action: string;
  recordedAt: Date | string;
};

export type OnsiteWorker = {
  workerId: string;
  workerName: string;
  company: string;
  trade: string;
  checkedInAt: Date | string;
};

export function buildOnsiteRoster(rows: Movement[]): OnsiteWorker[] {
  const latest = new Map<string, Movement>();
  for (const row of rows) latest.set(row.workerId, row);
  return [...latest.values()]
    .filter((row) => row.action === "IN")
    .map((row) => ({
      workerId: row.workerId,
      workerName: row.workerName,
      company: row.company,
      trade: row.trade,
      checkedInAt: row.recordedAt,
    }))
    .sort((a, b) => a.workerName.localeCompare(b.workerName));
}

export type ShiftRow = {
  workerId: string;
  workerName: string;
  company: string;
  trade: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  hours: number | null;
  open: boolean;
};

/** Pair chronological IN→OUT punches into shifts with decimal hours. */
export function pairShifts(rows: Movement[]): ShiftRow[] {
  const byWorker = new Map<string, Movement[]>();
  for (const row of rows) {
    const list = byWorker.get(row.workerId) || [];
    list.push(row);
    byWorker.set(row.workerId, list);
  }

  const shifts: ShiftRow[] = [];
  for (const [, list] of byWorker) {
    const ordered = list
      .slice()
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    let openIn: Movement | null = null;
    for (const row of ordered) {
      if (row.action === "IN") {
        if (openIn) {
          shifts.push({
            workerId: openIn.workerId,
            workerName: openIn.workerName,
            company: openIn.company,
            trade: openIn.trade,
            checkedInAt: new Date(openIn.recordedAt).toISOString(),
            checkedOutAt: null,
            hours: null,
            open: true,
          });
        }
        openIn = row;
      } else if (row.action === "OUT" && openIn) {
        const inAt = new Date(openIn.recordedAt).getTime();
        const outAt = new Date(row.recordedAt).getTime();
        const hours = Math.max(0, (outAt - inAt) / (1000 * 60 * 60));
        shifts.push({
          workerId: openIn.workerId,
          workerName: openIn.workerName,
          company: openIn.company,
          trade: openIn.trade,
          checkedInAt: new Date(openIn.recordedAt).toISOString(),
          checkedOutAt: new Date(row.recordedAt).toISOString(),
          hours: Math.round(hours * 100) / 100,
          open: false,
        });
        openIn = null;
      }
    }
    if (openIn) {
      shifts.push({
        workerId: openIn.workerId,
        workerName: openIn.workerName,
        company: openIn.company,
        trade: openIn.trade,
        checkedInAt: new Date(openIn.recordedAt).toISOString(),
        checkedOutAt: null,
        hours: null,
        open: true,
      });
    }
  }

  return shifts.sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());
}

export function formatHours(hours: number | null | undefined) {
  if (hours == null || Number.isNaN(hours)) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
