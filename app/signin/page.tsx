"use client";

import { FormEvent, useMemo, useState } from "react";

export default function SignInPage() {
  const [step, setStep] = useState<"login" | "change">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const value = new URLSearchParams(window.location.search).get("next");
    return value === "/console" || value === "/platform" ? value : "/";
  }, []);

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in");
      if (data.mustChangePassword) {
        setStep("change");
        setSaving(false);
        return;
      }
      window.location.replace(nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in");
      setSaving(false);
    }
  };

  const change = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirmPassword")) {
      setError("Passwords do not match");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          newPassword: form.get("newPassword"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to change password");
      window.location.replace(nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change password");
      setSaving(false);
    }
  };

  return (
    <main className="login-shell">
      {step === "login" ? (
        <form className="login-card" onSubmit={verify}>
          <h1>Sign in</h1>
          <p>Use your company email and password.</p>
          {error && <p className="form-error">{error}</p>}
          <label>
            Company email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="primary-button" disabled={saving}>
            {saving ? "Signing in…" : "Sign in →"}
          </button>
          <details className="login-forgot">
            <summary>Forgot password?</summary>
            <p>
              Ask a project admin to issue a temporary password. If you are the admin on this
              machine, run <code>npm run db:reset-admin</code> then sign in with the printed
              temporary password.
            </p>
          </details>
        </form>
      ) : (
        <form className="login-card" onSubmit={change}>
          <p className="eyebrow">FIRST SIGN IN</p>
          <h1>Create a new password</h1>
          <p>Replace your temporary password before continuing.</p>
          {error && <p className="form-error">{error}</p>}
          <label>
            New password
            <input name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
          </label>
          <label>
            Confirm password
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required />
          </label>
          <div className="password-rules">
            <span>✓ 10+ characters</span>
            <span>✓ Uppercase &amp; number</span>
          </div>
          <button className="primary-button" disabled={saving}>
            {saving ? "Saving…" : "Set password and enter →"}
          </button>
        </form>
      )}
    </main>
  );
}
