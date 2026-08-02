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
  const [addingCompany, setAddingCompany] = useState(false);

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
        } else {
          setAddingCompany(true);
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
    setAddingCompany(false);
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
      setAddingCompany(false);
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

      <section className="console-panel console-companies-panel">
        <div className="console-panel-head">
          <h2>1. Choose company</h2>
          <span>{companies.length} compan{companies.length === 1 ? "y" : "ies"}</span>
        </div>
        <p className="console-lead">
          Tap a company below to manage its projects and customer admins. Use + to add another company.
        </p>

        <div className="company-picker">
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              className={`company-chip ${selectedId === company.id ? "active" : ""}`}
              onClick={() => void selectCompany(company.id)}
            >
              <strong>{company.name}</strong>
              <small>
                {company.code} · {company.projectCount} project{company.projectCount === 1 ? "" : "s"}
              </small>
              {selectedId === company.id && <em>Selected</em>}
            </button>
          ))}

          <button
            type="button"
            className={`company-chip company-chip-add ${addingCompany ? "active" : ""}`}
            onClick={() => {
              setAddingCompany(true);
              setSelectedId(null);
              setProjects([]);
              setAdmins([]);
              setInviteNotice(null);
            }}
          >
            <strong>+ Add company</strong>
            <small>Create a new customer</small>
          </button>
        </div>

        {addingCompany && (
          <form className="console-form console-add-company" onSubmit={addCompany}>
            <h3>New company</h3>
            <label>
              Company name
              <input name="name" placeholder="e.g. Another Construction Pte Ltd" required />
            </label>
            <label>
              Code (optional)
              <input name="code" placeholder="e.g. ACME" />
            </label>
            <label>
              Contact name
              <input name="contactName" placeholder="Contact person" />
            </label>
            <label>
              Contact email
              <input name="contactEmail" type="email" placeholder="ops@company.com" />
            </label>
            <label>
              Notes
              <input name="notes" placeholder="Trial / multi-site / etc." />
            </label>
            <div className="console-form-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setAddingCompany(false);
                  if (companies[0]) void selectCompany(companies[0].id);
                }}
              >
                Cancel
              </button>
              <button className="primary-button" disabled={saving}>
                {saving ? "Saving…" : "Save company"}
              </button>
            </div>
          </form>
        )}
      </section>

      {selected && !addingCompany ? (
        <>
          <div className="console-selected-banner">
            Managing: <strong>{selected.name}</strong>
          </div>
          <div className="console-grid">
            <section className="console-panel">
              <div className="console-panel-head">
                <h2>2. Projects</h2>
                <span>for this company</span>
              </div>

              <form className="console-form" onSubmit={addProject}>
                <label>
                  Project name
                  <input name="name" placeholder="e.g. Site A / Jurong works" required />
                </label>
                <label>
                  Code (optional)
                  <input name="code" placeholder="e.g. SITE-A" />
                </label>
                <label>
                  Address / area
                  <input name="address" placeholder="e.g. Singapore" />
                </label>
                <label>
                  Notes
                  <input name="notes" placeholder="Optional notes" />
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
                {!projects.length && <p className="console-empty">No projects yet. Add one above.</p>}
              </div>
            </section>

            <section className="console-panel">
              <div className="console-panel-head">
                <h2>3. Customer Admins</h2>
                <span>for this company</span>
              </div>

              <form className="console-form" onSubmit={addAdmin}>
                <label>
                  Admin name
                  <input name="name" placeholder="e.g. Owen" required />
                </label>
                <label>
                  Company email
                  <input name="email" type="email" placeholder="e.g. owen@company.com" required />
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
                <p className="console-hint">
                  Creates a Project Admin for <strong>{selected.name}</strong>. They must change password on first
                  login at hubblefields.com/signin.
                </p>
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
                {!admins.length && <p className="console-empty">No admins yet. Create one above.</p>}
              </div>
            </section>
          </div>
        </>
      ) : (
        !addingCompany && (
          <p className="console-empty console-empty-main">Select a company above, or tap + Add company.</p>
        )
      )}
    </main>
  );
}
