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

export default function ConsolePage() {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [userName, setUserName] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
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
          await loadProjects(list[0].id);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to open console");
      } finally {
        setReady(true);
      }
    })();
  }, [loadCompanies, loadProjects]);

  async function selectCompany(id: number) {
    setSelectedId(id);
    setError("");
    try {
      await loadProjects(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load projects");
    }
  }

  async function addCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
      const list = await loadCompanies();
      setSelectedId(data.company.id);
      await loadProjects(data.company.id);
      if (!list.find((row) => row.id === data.company.id)) {
        setCompanies((prev) => [data.company, ...prev]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create company");
    } finally {
      setSaving(false);
    }
  }

  async function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const form = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
      await loadProjects(selectedId);
      await loadCompanies();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create project");
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

      <div className="console-grid">
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
      </div>
    </main>
  );
}
