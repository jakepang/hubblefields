"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Company = {
  id: number;
  name: string;
  code: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  projectCount: number;
};

type Project = {
  id: number;
  companyId: number;
  name: string;
  code: string;
  status: string;
  address: string | null;
  notes: string | null;
};

type CompanyAdmin = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
};

type InviteNotice = {
  email: string;
  temporaryPassword: string;
};

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "Qs";
  for (let i = 0; i < 10; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${out}1`;
}

export default function ConsolePage() {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [userName, setUserName] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [admins, setAdmins] = useState<CompanyAdmin[]>([]);
  const [adminPassword, setAdminPassword] = useState(() => generatePassword());
  const [inviteNotice, setInviteNotice] = useState<InviteNotice | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = companies.find((row) => row.id === selectedId) || null;

  const loadCompanies = useCallback(async () => {
    const response = await fetch("/api/console/companies", { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load companies");
    setCompanies(data.companies || []);
    return data.companies as Company[];
  }, []);

  const loadProjects = useCallback(async (companyId: number) => {
    const response = await fetch(`/api/console/projects?companyId=${companyId}`, { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load projects");
    setProjects(data.projects || []);
  }, []);

  const loadAdmins = useCallback(async (companyId: number) => {
    const response = await fetch(`/api/console/users?companyId=${companyId}`, { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load admins");
    setAdmins(data.users || []);
  }, []);

  const loadCompanyDetails = useCallback(
    async (companyId: number) => {
      await Promise.all([loadProjects(companyId), loadAdmins(companyId)]);
    },
    [loadAdmins, loadProjects],
  );

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetch("/api/me", { credentials: "include" });
        if (!me.ok) {
          window.location.replace("/signin");
          return;
        }
        const data = await me.json();
        if (!data.user?.platformAdmin) {
          setAllowed(false);
          setReady(true);
          return;
        }
        setUserName(data.user.name || "");
        setAllowed(true);
        const list = await loadCompanies();
        if (list[0]) {
          setSelectedId(list[0].id);
          await loadCompanyDetails(list[0].id);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to open console");
      } finally {
        setReady(true);
      }
    })();
  }, [loadCompanies, loadCompanyDetails]);

  async function selectCompany(id: number) {
    setSelectedId(id);
    setError("");
    setInviteNotice(null);
    try {
      await loadCompanyDetails(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load company details");
    }
  }

  async function addCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/console/companies", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          code: form.get("code"),
          contactName: form.get("contactName"),
          contactEmail: form.get("contactEmail"),
          notes: form.get("notes"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create company");
      formEl.reset();
      await loadCompanies();
      setSelectedId(data.company.id);
      await loadCompanyDetails(data.company.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create company");
    } finally {
      setSaving(false);
    }
  }

  async function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/console/projects", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId: selectedId,
          name: form.get("name"),
          code: form.get("code"),
          address: form.get("address"),
          notes: form.get("notes"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create project");
      formEl.reset();
      await loadCompanyDetails(selectedId);
      await loadCompanies();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create project");
    } finally {
      setSaving(false);
    }
  }

  async function addAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setSaving(true);
    setError("");
    setInviteNotice(null);
    setCopied(false);
    try {
      const response = await fetch("/api/console/users", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId: selectedId,
          name: form.get("name"),
          email: form.get("email"),
          temporaryPassword: adminPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create admin");
      formEl.reset();
      setInviteNotice({
        email: data.user.email,
        temporaryPassword: data.temporaryPassword,
      });
      setAdminPassword(generatePassword());
      await loadAdmins(selectedId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create admin");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <main className="console-shell">
        <p className="console-loading">Loading console…</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="console-shell">
        <section className="console-denied">
          <h1>Platform Console</h1>
          <p>This area is only for Hubble Fields operators.</p>
          <Link href="/">Back to attendance app</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="console-shell">
      <header className="console-top">
        <div>
          <p className="eyebrow">HUBBLE FIELDS</p>
          <h1>Platform Console</h1>
          <small>Signed in as {userName}</small>
        </div>
        <div className="console-top-actions">
          <Link href="/">Attendance app</Link>
          <Link href="/signin">Sign in page</Link>
        </div>
      </header>

      {error && <p className="form-error console-error">{error}</p>}

      {inviteNotice && (
        <section className="console-invite">
          <div>
            <strong>Customer admin created</strong>
            <p>
              Share privately with <b>{inviteNotice.email}</b>. They must change it on first login.
            </p>
            <code>{inviteNotice.temporaryPassword}</code>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              void navigator.clipboard.writeText(inviteNotice.temporaryPassword);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy password"}
          </button>
        </section>
      )}

      <div className="console-grid console-grid-3">
        <section className="console-panel">
          <div className="console-panel-head">
            <h2>Companies</h2>
            <span>{companies.length}</span>
          </div>

          <form className="console-form" onSubmit={addCompany}>
            <label>
              Company name
              <input name="name" placeholder="QI SHENG CONSTRUCTION PTE. LTD." required />
            </label>
            <label>
              Code (optional)
              <input name="code" placeholder="QI-SHENG" />
            </label>
            <label>
              Contact name
              <input name="contactName" placeholder="Site manager" />
            </label>
            <label>
              Contact email
              <input name="contactEmail" type="email" placeholder="ops@company.com" />
            </label>
            <label>
              Notes
              <input name="notes" placeholder="Trial customer, multi-site" />
            </label>
            <button className="primary-button" disabled={saving}>
              {saving ? "Saving…" : "Add company"}
            </button>
          </form>

          <div className="console-list">
            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                className={`console-company ${selectedId === company.id ? "active" : ""}`}
                onClick={() => void selectCompany(company.id)}
              >
                <strong>{company.name}</strong>
                <small>
                  {company.code} · {company.projectCount} project{company.projectCount === 1 ? "" : "s"} ·{" "}
                  {company.status}
                </small>
              </button>
            ))}
            {!companies.length && <p className="console-empty">No companies yet. Add your first customer above.</p>}
          </div>
        </section>

        <section className="console-panel">
          <div className="console-panel-head">
            <h2>Projects</h2>
            <span>{selected ? selected.name : "Select a company"}</span>
          </div>

          {selected ? (
            <>
              <form className="console-form" onSubmit={addProject}>
                <label>
                  Project name
                  <input name="name" placeholder="Changi Coast works" required />
                </label>
                <label>
                  Code (optional)
                  <input name="code" placeholder="CHANGI-01" />
                </label>
                <label>
                  Address / area
                  <input name="address" placeholder="Singapore" />
                </label>
                <label>
                  Notes
                  <input name="notes" placeholder="Dispersed sites, Singapore geofence" />
                </label>
                <button className="primary-button" disabled={saving}>
                  {saving ? "Saving…" : "Add project"}
                </button>
              </form>

              <div className="console-list">
                {projects.map((project) => (
                  <div key={project.id} className="console-project">
                    <strong>{project.name}</strong>
                    <small>
                      {project.code} · {project.status}
                      {project.address ? ` · ${project.address}` : ""}
                    </small>
                    {project.notes && <em>{project.notes}</em>}
                  </div>
                ))}
                {!projects.length && <p className="console-empty">No projects yet for this company.</p>}
              </div>
            </>
          ) : (
            <p className="console-empty">Select a company to manage its projects.</p>
          )}
        </section>

        <section className="console-panel">
          <div className="console-panel-head">
            <h2>Customer Admins</h2>
            <span>{selected ? selected.name : "Select a company"}</span>
          </div>

          {selected ? (
            <>
              <form className="console-form" onSubmit={addAdmin}>
                <label>
                  Admin name
                  <input name="name" placeholder="Site Admin" required />
                </label>
                <label>
                  Company email
                  <input name="email" type="email" placeholder="admin@company.com" required />
                </label>
                <label>
                  Temporary password
                  <div className="console-password-row">
                    <input
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      minLength={10}
                      required
                    />
                    <button type="button" onClick={() => setAdminPassword(generatePassword())}>
                      Generate
                    </button>
                  </div>
                </label>
                <p className="console-hint">Creates a Project Admin for this company. They must change password on first login.</p>
                <button className="primary-button" disabled={saving}>
                  {saving ? "Saving…" : "Create admin account"}
                </button>
              </form>

              <div className="console-list">
                {admins.map((admin) => (
                  <div key={admin.id} className="console-project">
                    <strong>{admin.name}</strong>
                    <small>
                      {admin.email} · {admin.role} · {admin.status}
                    </small>
                  </div>
                ))}
                {!admins.length && <p className="console-empty">No customer admins yet for this company.</p>}
              </div>
            </>
          ) : (
            <p className="console-empty">Select a company to create its admin accounts.</p>
          )}
        </section>
      </div>
    </main>
  );
}
