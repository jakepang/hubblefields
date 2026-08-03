"use client";

import { FormEvent, useMemo, useState } from "react";

type Worker = {
  workerId: string;
  name: string;
  company: string;
  trade: string;
  status?: "Active" | "Inactive";
};

export type ManualAttendanceTarget = {
  id: number;
  workerId: string;
  workerName: string;
  action: "IN" | "OUT";
  recordedAt: string;
  remarks?: string | null;
};

type Props = {
  mode: "create" | "edit";
  workers: Worker[];
  defaultDate: string;
  editing?: ManualAttendanceTarget | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: {
    workerId: string;
    action: "IN" | "OUT";
    recordedAt: string;
    remarks: string;
  }) => Promise<void>;
};

function toDatetimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultDatetime(defaultDate: string) {
  const now = new Date();
  const [year, month, day] = defaultDate.split("-").map(Number);
  if (year && month && day) {
    const candidate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), 0, 0);
    return toDatetimeLocalValue(candidate);
  }
  return toDatetimeLocalValue(now);
}

export function ManualAttendanceModal({
  mode,
  workers,
  defaultDate,
  editing,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [query, setQuery] = useState("");
  const [workerId, setWorkerId] = useState(editing?.workerId || "");
  const [action, setAction] = useState<"IN" | "OUT">(editing?.action || "IN");
  const [recordedAt, setRecordedAt] = useState(() =>
    editing?.recordedAt
      ? toDatetimeLocalValue(new Date(editing.recordedAt))
      : defaultDatetime(defaultDate),
  );
  const [remarks, setRemarks] = useState(editing?.remarks || "");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = workers.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return list;
    return list.filter((worker) => {
      const haystack = `${worker.name} ${worker.workerId} ${worker.company} ${worker.trade}`.toLowerCase();
      return haystack.includes(needle) || worker.workerId.slice(-4).includes(needle);
    });
  }, [workers, query]);

  const selected = workers.find((worker) => worker.workerId === workerId) || null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!workerId) return;
    const iso = new Date(recordedAt).toISOString();
    await onSubmit({
      workerId,
      action,
      recordedAt: iso,
      remarks: remarks.trim(),
    });
  }

  return (
    <div className="modal-backdrop">
      <form className="modal manual-attendance-modal" onSubmit={handleSubmit}>
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">PROJECT ADMIN</p>
        <h2>{mode === "edit" ? "Edit punch time" : "Manual punch"}</h2>
        <p>
          {mode === "edit"
            ? "Correct the punch time or action. A reason is required for the audit trail."
            : "Backfill a missed check-in or check-out. GPS and photo are not required."}
        </p>
        {error && <p className="form-error">{error}</p>}

        {mode === "create" ? (
          <>
            <label>
              Search worker
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name / ID last 4 / trade"
              />
            </label>
            <label>
              Worker
              <select
                value={workerId}
                onChange={(event) => setWorkerId(event.target.value)}
                required
              >
                <option value="">Select worker</option>
                {filtered.map((worker) => (
                  <option key={worker.workerId} value={worker.workerId}>
                    {worker.name} · {worker.workerId.slice(-4)} · {worker.trade}
                    {worker.status === "Inactive" ? " (Inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="manual-worker-summary">
            <strong>{editing?.workerName}</strong>
            <small>
              {editing?.workerId}
              {selected ? ` · ${selected.company} · ${selected.trade}` : ""}
            </small>
          </div>
        )}

        <div className="form-pair">
          <label>
            Action
            <select
              value={action}
              onChange={(event) => setAction(event.target.value === "OUT" ? "OUT" : "IN")}
            >
              <option value="IN">Check In</option>
              <option value="OUT">Check Out</option>
            </select>
          </label>
          <label>
            Punch time
            <input
              type="datetime-local"
              value={recordedAt}
              onChange={(event) => setRecordedAt(event.target.value)}
              required
            />
          </label>
        </div>

        <label>
          Reason (required)
          <textarea
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            maxLength={300}
            rows={3}
            placeholder="e.g. Phone offline / GPS failed / forgotten checkout"
            required
          />
        </label>

        <button className="primary-button" disabled={saving || !workerId || !remarks.trim()}>
          {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add manual punch"}
        </button>
      </form>
    </div>
  );
}
