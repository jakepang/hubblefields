"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AttendanceModal } from "@/components/AttendanceModal";
import { OfflineSyncBootstrap } from "@/components/OfflineSyncBootstrap";
import { SettingsPanel } from "@/components/SettingsPanel";
import { formatHours, localDateString } from "@/lib/attendance";
import { t } from "@/lib/i18n";
import { submitPunchWithOffline } from "@/lib/offline/sync";
import { loadPrefs, ORG_NAME, PROJECT_NAME, type AppLanguage } from "@/lib/prefs";

type ProjectUser = { id: number; name: string; email: string; role: string; platformAdmin?: boolean };
type ManagedUser = { name: string; email: string; role: string; status: string };
type Worker = {
  id: number;
  workerId: string;
  name: string;
  company: string;
  trade: string;
  status: "Active" | "Inactive";
};
type OnsiteWorker = {
  workerId: string;
  workerName: string;
  company: string;
  trade: string;
  checkedInAt: string;
};
type ShiftRow = {
  workerId: string;
  workerName: string;
  company: string;
  trade: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  hours: number | null;
  open: boolean;
};
type RecordRow = {
  id: number;
  workerId: string;
  workerName: string;
  company: string;
  trade: string;
  action: "IN" | "OUT";
  recordedAt: string;
  recordedByUserId: number;
  recordedByName?: string;
  hasPhoto?: boolean;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean | null;
  distanceM?: number | null;
};
type Stats = {
  onsite: number;
  checkedIn: number;
  checkedOut: number;
  totalHours?: number;
  openShifts?: number;
};
type View = "overview" | "history" | "manpower" | "reports" | "users" | "settings";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "…";
}

function generatePassword() {
  const required = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$"];
  const all = required.join("");
  const randomIndex = (length: number) => crypto.getRandomValues(new Uint32Array(1))[0] % length;
  const chars = required.map((group) => group[randomIndex(group.length)]);
  while (chars.length < 14) chars.push(all[randomIndex(all.length)]);
  for (let index = chars.length - 1; index > 0; index--) {
    const swap = randomIndex(index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  return chars.join("");
}

function RecordList({ records }: { records: RecordRow[] }) {
  if (!records.length) {
    return (
      <div className="empty-state">
        <strong>No attendance records yet</strong>
        <span>Use Check In to record the first worker arrival.</span>
      </div>
    );
  }
  return (
    <div className="attendance-list">
      {records.map((record) => (
        <div className="attendance-row" key={record.id}>
          <span className={`movement ${record.action.toLowerCase()}`}>{record.action === "IN" ? "↘" : "↗"}</span>
          <div>
            <strong>{record.workerName}</strong>
            <small>
              {record.workerId} · {record.company} · {record.trade}
            </small>
            <small className="record-meta">
              {record.locationVerified === true && "On site"}
              {record.locationVerified === false &&
                `Off site${record.distanceM != null ? ` · ${Math.round(record.distanceM)}m` : ""}`}
              {record.locationVerified == null && "No GPS"}
              {record.hasPhoto ? " · Photo" : " · No photo"}
              {record.recordedByName ? ` · by ${record.recordedByName}` : ""}
              {record.hasPhoto && (
                <>
                  {" · "}
                  <a
                    href={record.photoUrl || `/api/attendance/${record.id}/photo`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </a>
                </>
              )}
            </small>
          </div>
          <b className={record.action === "IN" ? "in" : "out"}>
            {record.action === "IN" ? "CHECKED IN" : "CHECKED OUT"}
          </b>
          <time>
            {new Date(record.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
        </div>
      ))}
    </div>
  );
}

function TradeBreakdown({ records }: { records: RecordRow[] }) {
  const counts = records.reduce<Record<string, number>>((all, row) => {
    all[row.trade] = (all[row.trade] || 0) + 1;
    return all;
  }, {});
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return (
      <div className="empty-state">
        <strong>No data for this period</strong>
        <span>Choose another date range and run the report.</span>
      </div>
    );
  }
  return (
    <div className="trade-breakdown">
      {entries.map(([trade, count]) => (
        <div key={trade}>
          <span>{trade}</span>
          <b>{count}</b>
          <i style={{ width: `${Math.max(8, (count / records.length) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const today = localDateString();
  const [user, setUser] = useState<ProjectUser | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [onsiteNow, setOnsiteNow] = useState<OnsiteWorker[]>([]);
  const [historyDate, setHistoryDate] = useState(today);
  const [historyRecords, setHistoryRecords] = useState<RecordRow[]>([]);
  const [historyStats, setHistoryStats] = useState<Stats>({ onsite: 0, checkedIn: 0, checkedOut: 0 });
  const [reportRecords, setReportRecords] = useState<RecordRow[]>([]);
  const [reportShifts, setReportShifts] = useState<ShiftRow[]>([]);
  const [reportStats, setReportStats] = useState<Stats>({ onsite: 0, checkedIn: 0, checkedOut: 0 });
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [stats, setStats] = useState<Stats>({ onsite: 0, checkedIn: 0, checkedOut: 0 });
  const [view, setView] = useState<View>("overview");
  const [action, setAction] = useState<"IN" | "OUT" | null>(null);
  const [preselectedWorkerId, setPreselectedWorkerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reportFrom, setReportFrom] = useState(today);
  const [reportTo, setReportTo] = useState(today);
  const [error, setError] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [resetError, setResetError] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingWorker, setAddingWorker] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Supervisor");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [inviteNotice, setInviteNotice] = useState("");
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetDone, setResetDone] = useState<{ email: string; password: string } | null>(null);
  const [lang, setLang] = useState<AppLanguage>("en");

  useEffect(() => {
    const prefs = loadPrefs();
    setLang(prefs.language);
    const onStorage = () => setLang(loadPrefs().language);
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(() => {
      const next = loadPrefs().language;
      setLang((current) => (current === next ? current : next));
    }, 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, []);

  const isAdmin = user?.role === "Project Admin";
  const canAttend = Boolean(
    user &&
      ["Project Admin", "Supervisor", "Safety Officer", "Attendance Admin", "Project Manager"].includes(user.role),
  );

  const load = useCallback(async () => {
    const meRes = await fetch("/api/me", { credentials: "include" });
    if (meRes.status === 401) {
      window.location.replace("/signin");
      return;
    }
    const meData = await meRes.json();
    setUser(meData.user);

    const [attRes, workersRes] = await Promise.all([
      fetch("/api/attendance", { credentials: "include" }),
      fetch("/api/workers", { credentials: "include" }),
    ]);
    if (attRes.ok) {
      const att = await attRes.json();
      setRecords(att.records || []);
      setStats(att.stats || { onsite: 0, checkedIn: 0, checkedOut: 0 });
      setOnsiteNow(att.onsiteNow || []);
    }
    if (workersRes.ok) {
      const manpower = await workersRes.json();
      setWorkers(manpower.workers || []);
    }

    if (meData.user?.role === "Project Admin") {
      const usersRes = await fetch("/api/project-users", { credentials: "include" });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeWorkers = useMemo(() => workers.filter((worker) => worker.status === "Active"), [workers]);
  const filteredWorkers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return workers;
    return workers.filter((worker) =>
      `${worker.workerId} ${worker.name} ${worker.company} ${worker.trade}`.toLowerCase().includes(query),
    );
  }, [workers, search]);

  const onsiteWorkersForCheckout = useMemo(() => {
    const byId = new Map(activeWorkers.map((worker) => [worker.workerId, worker]));
    return onsiteNow.map((person) => {
      const known = byId.get(person.workerId);
      return (
        known || {
          id: 0,
          workerId: person.workerId,
          name: person.workerName,
          company: person.company,
          trade: person.trade,
          status: "Active" as const,
        }
      );
    });
  }, [activeWorkers, onsiteNow]);

  const loadHistory = useCallback(async (date: string) => {
    const response = await fetch(`/api/attendance?from=${date}&to=${date}`, { credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();
    setHistoryRecords(data.records || []);
    setHistoryStats(data.stats || { onsite: 0, checkedIn: 0, checkedOut: 0 });
  }, []);

  useEffect(() => {
    if (view === "history") void loadHistory(historyDate);
  }, [view, historyDate, loadHistory]);

  async function saveAttendance(payload: {
    workerId: string;
    remarks: string;
    photoDataUrl: string;
    latitude: number;
    longitude: number;
    accuracyM: number | null;
  }) {
    if (!action) return;
    setSaving(true);
    setError("");
    try {
      const result = await submitPunchWithOffline({
        workerId: payload.workerId,
        action,
        remarks: payload.remarks,
        photoDataUrl: payload.photoDataUrl,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracyM: payload.accuracyM,
      });
      setAction(null);
      setPreselectedWorkerId(null);
      setSaving(false);
      if (result.queued) {
        setError(""); // clear; show banner via OfflineSyncBootstrap
      }
      await load();
      if (view === "history") await loadHistory(historyDate);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save attendance");
      setSaving(false);
    }
  }

  async function addWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/workers", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workerId: form.get("workerId"),
        name: form.get("name"),
        company: form.get("company"),
        trade: form.get("trade"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Unable to add worker");
      setSaving(false);
      return;
    }
    setAddingWorker(false);
    setSaving(false);
    await load();
  }

  async function toggleWorker(worker: Worker) {
    await fetch("/api/workers", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: worker.id,
        status: worker.status === "Active" ? "Inactive" : "Active",
      }),
    });
    await load();
  }

  async function inviteUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setInviteError("");
    const response = await fetch("/api/project-users", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        temporaryPassword,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setInviteError(data.error || "Unable to create account");
      setSaving(false);
      return;
    }
    setInviteOpen(false);
    setInviteNotice(inviteEmail);
    setInviteName("");
    setInviteEmail("");
    setTemporaryPassword("");
    setSaving(false);
    await load();
  }

  async function resetPasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (!resetEmail) return;
    setSaving(true);
    setResetError("");
    const response = await fetch("/api/project-users", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: resetEmail, temporaryPassword: resetPassword }),
    });
    const data = await response.json();
    if (!response.ok) {
      setResetError(data.error || "Unable to reset password");
      setSaving(false);
      return;
    }
    setResetDone({ email: data.user.email, password: resetPassword });
    setResetEmail(null);
    setResetPassword("");
    setSaving(false);
    await load();
  }

  async function loadReport() {
    const response = await fetch(`/api/attendance?from=${reportFrom}&to=${reportTo}`, {
      credentials: "include",
    });
    const data = await response.json();
    if (response.ok) {
      setReportRecords(data.records || []);
      setReportShifts(data.shifts || []);
      setReportStats(data.stats || { onsite: 0, checkedIn: 0, checkedOut: 0 });
    }
  }

  function openCheckout(workerId?: string) {
    setAction("OUT");
    setPreselectedWorkerId(workerId || null);
    setError("");
  }

  function openCheckin() {
    setAction("IN");
    setPreselectedWorkerId(null);
    setError("");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.replace("/signin");
  }

  const avatar = initials(user?.name || "PA");

  return (
    <main className="app-shell">
      <OfflineSyncBootstrap onSynced={() => void load()} />
      <aside className="rail">
        <button className="brand" onClick={() => setView("overview")}>
          <img src="/cccc-obayashi-jv.png" alt={ORG_NAME} />
          <span>
            <strong>{ORG_NAME}</strong>
            <small>Attendance</small>
          </span>
        </button>
        <div className="project-badge">
          <small>COMPANY</small>
          <strong>{PROJECT_NAME}</strong>
          <span>Singapore · Multi-site</span>
        </div>
        <nav>
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>
            <span>⌂</span> Overview
          </button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>
            <span>◷</span> Attendance History
          </button>
          <button className={view === "manpower" ? "active" : ""} onClick={() => setView("manpower")}>
            <span>♙</span> Manpower
          </button>
          {isAdmin && (
            <>
              <button
                className={view === "reports" ? "active" : ""}
                onClick={() => {
                  setView("reports");
                  void loadReport();
                }}
              >
                <span>▣</span> Reports
              </button>
              <p>ADMINISTRATION</p>
              <button className={view === "users" ? "active" : ""} onClick={() => setView("users")}>
                <span>♧</span> User access
              </button>
            </>
          )}
          <p>ACCOUNT</p>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
            <span>⚙</span> Settings
          </button>
        </nav>
        <div className="profile">
          <button type="button" className="profile-open" onClick={() => setView("settings")}>
            <span className="avatar">{avatar}</span>
            <div>
              <strong>{user?.name || "Loading…"}</strong>
              <small>{user?.role || "Project user"}</small>
            </div>
          </button>
          <button onClick={() => void logout()} title="Sign out" aria-label="Sign out">
            ↪
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="fixed-project">
            <small>COMPANY</small>
            <strong>{PROJECT_NAME}</strong>
          </div>
        </header>

        <header className="mobile-top">
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label={t(lang, "more")}
            onClick={() => setView(view === "settings" ? "overview" : "settings")}
          >
            {view === "settings" ? "✕" : "☰"}
          </button>
          <span className="mobile-title">
            {view === "settings" && t(lang, "more")}
            {view === "history" && t(lang, "history")}
            {view === "manpower" && t(lang, "manpower")}
            {view === "reports" && t(lang, "reports")}
            {view === "users" && t(lang, "userAccess")}
          </span>
          {view !== "overview" && view !== "settings" ? (
            <button type="button" className="mobile-menu-btn" onClick={() => setView("overview")} aria-label="Home">
              ⌂
            </button>
          ) : (
            <span className="mobile-top-spacer" />
          )}
        </header>

        <div className="page">
          {view === "overview" && (
            <>
              <section className="overview-top">
                {canAttend && (
                  <section className="action-grid action-stack">
                    <button className="action-card checkin" onClick={openCheckin}>
                      <span className="action-icon">↘</span>
                      <div>
                        <strong>Check In</strong>
                      </div>
                      <b>→</b>
                    </button>
                    <button className="action-card checkout" onClick={() => openCheckout()}>
                      <span className="action-icon">↗</span>
                      <div>
                        <strong>Check Out</strong>
                      </div>
                      <b>→</b>
                    </button>
                  </section>
                )}
                <section className="hero-card hero-card-simple">
                  <div className="onsite-copy">
                    <p>ONSITE</p>
                    <div className="big-number">{stats.onsite}</div>
                  </div>
                </section>
              </section>
              <section className="panel onsite-panel">
                <div className="panel-title">
                  <h2>Onsite</h2>
                </div>
                {onsiteNow.length ? (
                  <div className="onsite-list">
                    {onsiteNow.map((person) => (
                      <div className="onsite-row" key={person.workerId}>
                        <i>{initials(person.workerName)}</i>
                        <div>
                          <strong>{person.workerName}</strong>
                          <small>
                            {person.workerId.slice(-4)} ·{" "}
                            {new Date(person.checkedInAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>
                        </div>
                        {canAttend && (
                          <button type="button" onClick={() => openCheckout(person.workerId)}>
                            Out
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state compact">
                    <strong>Nobody onsite</strong>
                  </div>
                )}
              </section>
              <section className="panel recent-panel desktop-only">
                <div className="panel-title">
                  <h2>Latest activity</h2>
                  <button onClick={() => setView("history")}>View all</button>
                </div>
                <RecordList records={records.slice(0, 5)} />
              </section>
            </>
          )}

          {view === "settings" && user && (
            <SettingsPanel
              userName={user.name}
              userRole={user.role}
              userEmail={user.email}
              isAdmin={isAdmin}
              isPlatformAdmin={Boolean(user.platformAdmin)}
              onSignOut={() => void logout()}
              onOpenHistory={() => setView("history")}
              onOpenManpower={() => setView("manpower")}
              onOpenReports={
                isAdmin
                  ? () => {
                      setView("reports");
                      void loadReport();
                    }
                  : undefined
              }
              onOpenUsers={isAdmin ? () => setView("users") : undefined}
            />
          )}

          {view === "history" && (
            <>
              <div className="users-head compact-head">
                <div>
                  <h1>{t(lang, "history")}</h1>
                </div>
                <label className="history-date">
                  <input
                    type="date"
                    value={historyDate}
                    max={today}
                    onChange={(event) => setHistoryDate(event.target.value || today)}
                  />
                </label>
              </div>
              <section className="attendance-summary">
                <div>
                  <small>ONSITE</small>
                  <strong>{stats.onsite}</strong>
                </div>
                <div>
                  <small>IN</small>
                  <strong>{historyStats.checkedIn}</strong>
                </div>
                <div>
                  <small>OUT</small>
                  <strong>{historyStats.checkedOut}</strong>
                </div>
              </section>
              <section className="panel">
                <RecordList records={historyRecords} />
              </section>
            </>
          )}

          {view === "manpower" && (
            <>
              <div className="users-head compact-head">
                <div>
                  <h1>{t(lang, "manpower")}</h1>
                </div>
                {isAdmin && (
                  <button
                    className="primary-button"
                    onClick={() => {
                      setAddingWorker(true);
                      setError("");
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>
              <div className="search-box">
                <span>⌕</span>
                <input
                  aria-label="Search workers"
                  placeholder="Search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <section className="worker-directory">
                <div className="worker-directory-head">
                  <span>WORKER</span>
                  <span>COMPANY</span>
                  <span>TRADE</span>
                  <span>STATUS</span>
                  <span />
                </div>
                {filteredWorkers.length ? (
                  filteredWorkers.map((worker) => (
                    <div className="worker-directory-row" key={worker.id}>
                      <div>
                        <i>{initials(worker.name)}</i>
                        <span>
                          <strong>{worker.name}</strong>
                          <small>{worker.workerId}</small>
                        </span>
                      </div>
                      <span>{worker.company}</span>
                      <span>{worker.trade}</span>
                      <b className={worker.status.toLowerCase()}>{worker.status}</b>
                      {isAdmin ? (
                        <button onClick={() => void toggleWorker(worker)}>
                          {worker.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="empty-state compact">
                    <strong>No workers found</strong>
                  </div>
                )}
              </section>
            </>
          )}

          {isAdmin && view === "reports" && (
            <>
              <div className="users-head compact-head">
                <div>
                  <h1>{t(lang, "reports")}</h1>
                </div>
                <button
                  className="outline-button"
                  disabled={!reportRecords.length}
                  onClick={() => {
                    window.location.href = `/api/attendance/export?from=${reportFrom}&to=${reportTo}`;
                  }}
                >
                  CSV
                </button>
              </div>
              <section className="report-filter">
                <label>
                  From
                  <input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={reportTo}
                    min={reportFrom}
                    onChange={(event) => setReportTo(event.target.value)}
                  />
                </label>
                <button className="primary-button" onClick={() => void loadReport()}>
                  Run report
                </button>
              </section>
              <section className="attendance-summary">
                <div>
                  <small>TOTAL MOVEMENTS</small>
                  <strong>{reportRecords.length}</strong>
                </div>
                <div>
                  <small>CHECK INS</small>
                  <strong>{reportStats.checkedIn ?? reportRecords.filter((row) => row.action === "IN").length}</strong>
                </div>
                <div>
                  <small>TOTAL HOURS</small>
                  <strong>{formatHours(reportStats.totalHours ?? 0)}</strong>
                </div>
              </section>
              <section className="report-grid">
                <div className="panel">
                  <div className="panel-title">
                    <h2>By trade</h2>
                  </div>
                  <TradeBreakdown records={reportRecords} />
                </div>
                <div className="panel">
                  <div className="panel-title">
                    <h2>Shifts / hours</h2>
                  </div>
                  {reportShifts.length ? (
                    <div className="shift-list">
                      {reportShifts.map((shift) => (
                        <div className="shift-row" key={`${shift.workerId}-${shift.checkedInAt}`}>
                          <div>
                            <strong>{shift.workerName}</strong>
                            <small>
                              {shift.workerId.slice(-4)} · {shift.trade}
                            </small>
                          </div>
                          <span>
                            {new Date(shift.checkedInAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" → "}
                            {shift.checkedOutAt
                              ? new Date(shift.checkedOutAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "onsite"}
                          </span>
                          <b className={shift.open ? "open" : ""}>{formatHours(shift.hours)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <strong>No paired shifts yet</strong>
                      <span>Run the report after workers check in and out.</span>
                    </div>
                  )}
                </div>
              </section>
              <section className="panel">
                <div className="panel-title">
                  <h2>Movements</h2>
                </div>
                <RecordList records={reportRecords} />
              </section>
            </>
          )}

          {isAdmin && view === "users" && (
            <>
              <div className="users-head compact-head">
                <div>
                  <h1>{t(lang, "userAccess")}</h1>
                </div>
                <button
                  className="primary-button"
                  onClick={() => {
                    setInviteOpen(true);
                    setInviteNotice("");
                    setResetDone(null);
                    setTemporaryPassword(generatePassword());
                    setShowPassword(true);
                    setInviteError("");
                  }}
                >
                  ＋ Invite
                </button>
              </div>
              {inviteNotice && (
                <div className="notice">
                  <span>✓</span>
                  <div>
                    <strong>Account created</strong>
                    <p>
                      Send {inviteNotice} the temporary password separately. It expires in 7 days and must be changed
                      at first login.
                    </p>
                  </div>
                </div>
              )}
              {resetDone && (
                <div className="notice">
                  <span>✓</span>
                  <div>
                    <strong>Temporary password reset</strong>
                    <p>Share this password privately with {resetDone.email}.</p>
                    <code>{resetDone.password}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(resetDone.password)}
                  >
                    Copy
                  </button>
                </div>
              )}
              <div className="access-summary">
                <div>
                  <strong>{users.length}</strong>
                  <small>Total users</small>
                </div>
                <div>
                  <strong>{users.filter((item) => item.status === "Active").length}</strong>
                  <small>Active accounts</small>
                </div>
                <div>
                  <strong>{users.filter((item) => item.status !== "Active").length}</strong>
                  <small>First login required</small>
                </div>
              </div>
              <div className="user-table">
                <div className="user-table-head">
                  <span>USER</span>
                  <span>ROLE</span>
                  <span>STATUS</span>
                  <span />
                </div>
                {users.map((item) => (
                  <div className="user-table-row" key={item.email}>
                    <span className="user-name">
                      <i>{initials(item.name)}</i>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.email}</small>
                      </span>
                    </span>
                    <span className="role-pill">{item.role}</span>
                    <span className={`status ${item.status === "Temporary password" ? "temporary" : item.status.toLowerCase()}`}>
                      ● {item.status}
                    </span>
                    {item.role === "Project Admin" ? (
                      <span />
                    ) : (
                      <button
                        onClick={() => {
                          setResetDone(null);
                          setResetEmail(item.email);
                          setResetPassword(generatePassword());
                          setResetError("");
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      {action && (
        <AttendanceModal
          action={action}
          workers={action === "OUT" ? onsiteWorkersForCheckout : activeWorkers}
          initialWorkerId={preselectedWorkerId}
          emptyLabel={action === "OUT" ? "Nobody currently onsite" : undefined}
          recorderName={user?.name}
          saving={saving}
          error={error}
          onClose={() => {
            setAction(null);
            setPreselectedWorkerId(null);
            setError("");
          }}
          onSubmit={saveAttendance}
        />
      )}

      {isAdmin && addingWorker && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={addWorker}>
            <button type="button" className="modal-close" onClick={() => setAddingWorker(false)}>
              ×
            </button>
            <p className="eyebrow">MANPOWER</p>
            <h2>Add worker</h2>
            <p>Create a reusable worker profile for attendance.</p>
            {error && <p className="form-error">{error}</p>}
            <label>
              Worker ID
              <input name="workerId" placeholder="Last four only, e.g. 0184" maxLength={4} required />
            </label>
            <label>
              Full name
              <input name="name" placeholder="Worker name" required />
            </label>
            <div className="form-pair">
              <label>
                Company
                <input name="company" placeholder="Employer" required />
              </label>
              <label>
                Trade
                <input name="trade" placeholder="e.g. Rigger" required />
              </label>
            </div>
            <button className="primary-button" disabled={saving}>
              {saving ? "Saving…" : "Add worker"}
            </button>
          </form>
        </div>
      )}

      {inviteOpen && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={inviteUser}>
            <button type="button" className="modal-close" onClick={() => setInviteOpen(false)}>
              ×
            </button>
            <p className="eyebrow">USER ACCESS</p>
            <h2>Create management account</h2>
            <p>Create the user with a company email and a one-time temporary password.</p>
            {inviteError && <p className="form-error">{inviteError}</p>}
            <label>
              Full name
              <input value={inviteName} onChange={(event) => setInviteName(event.target.value)} required />
            </label>
            <label>
              Company email
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Temporary password
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={temporaryPassword}
                  onChange={(event) => {
                    setTemporaryPassword(event.target.value);
                    setPasswordCopied(false);
                  }}
                  minLength={10}
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <div className="password-tools">
              <button
                type="button"
                onClick={() => {
                  setTemporaryPassword(generatePassword());
                  setShowPassword(true);
                  setPasswordCopied(false);
                }}
              >
                ↻ Generate
              </button>
              <button
                type="button"
                disabled={!temporaryPassword}
                onClick={() => {
                  void navigator.clipboard.writeText(temporaryPassword);
                  setPasswordCopied(true);
                }}
              >
                {passwordCopied ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <label>
              Project role
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                <option>Supervisor</option>
                <option>Safety Officer</option>
                <option>Attendance Admin</option>
                <option>Project Manager</option>
                <option>Viewer</option>
              </select>
            </label>
            <button className="primary-button" disabled={saving}>
              {saving ? "Creating…" : "Create account →"}
            </button>
          </form>
        </div>
      )}

      {resetEmail && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={resetPasswordSubmit}>
            <button type="button" className="modal-close" onClick={() => setResetEmail(null)}>
              ×
            </button>
            <p className="eyebrow">PASSWORD RESET</p>
            <h2>Reset temporary password</h2>
            <p>
              Issue a new temporary password for <strong>{resetEmail}</strong>.
            </p>
            {resetError && <p className="form-error">{resetError}</p>}
            <label>
              Temporary password
              <div className="password-field">
                <input
                  type="text"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  minLength={10}
                  required
                />
                <button type="button" onClick={() => setResetPassword(generatePassword())}>
                  Generate
                </button>
              </div>
            </label>
            <button className="primary-button" disabled={saving}>
              {saving ? "Saving…" : "Reset password →"}
            </button>
          </form>
        </div>
      )}
      </section>
    </main>
  );
}
