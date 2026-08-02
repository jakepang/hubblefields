"use client";

import { useEffect, useState } from "react";
import { t, type MsgKey } from "@/lib/i18n";
import {
  APP_BUILD,
  APP_VERSION,
  ORG_NAME,
  PROJECT_NAME,
  loadPrefs,
  savePrefs,
  type AppLanguage,
  type AppPrefs,
} from "@/lib/prefs";

type Screen = "home" | "notifications" | "gps" | "offline" | "projects" | "help" | "report";

type Props = {
  userName: string;
  userRole: string;
  userEmail?: string;
  isAdmin?: boolean;
  onSignOut: () => void;
  onClose?: () => void;
  onOpenHistory?: () => void;
  onOpenManpower?: () => void;
  onOpenReports?: () => void;
  onOpenUsers?: () => void;
  embedded?: boolean;
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "…"
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`pref-toggle ${checked ? "on" : ""}`}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}

export function SettingsPanel({
  userName,
  userRole,
  userEmail,
  isAdmin,
  onSignOut,
  onClose,
  onOpenHistory,
  onOpenManpower,
  onOpenReports,
  onOpenUsers,
  embedded,
}: Props) {
  const [prefs, setPrefs] = useState<AppPrefs>(() => loadPrefs());
  const [screen, setScreen] = useState<Screen>("home");
  const [langOpen, setLangOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const lang = prefs.language;

  useEffect(() => {
    savePrefs(prefs);
    document.documentElement.lang = prefs.language === "zh" ? "zh-CN" : "en";
  }, [prefs]);

  function update(partial: Partial<AppPrefs>) {
    setPrefs((current) => ({ ...current, ...partial }));
  }

  function setLanguage(language: AppLanguage) {
    update({ language });
    setLangOpen(false);
  }

  function openDeviceSettings() {
    // Browsers cannot deep-link to OS location settings reliably; guide the user.
    window.alert(
      lang === "zh"
        ? "请在系统设置中打开：设置 → 隐私/位置 → 浏览器/本站 → 允许位置访问。"
        : "Open your device Settings → Privacy / Location → Browser (or this site) → Allow location access.",
    );
  }

  function sendReport() {
    const subject = encodeURIComponent(`[Qi Sheng Attendance] Issue from ${userName}`);
    const body = encodeURIComponent(
      [
        `Name: ${userName}`,
        `Role: ${userRole}`,
        `Email: ${userEmail || "-"}`,
        `App: ${APP_VERSION} (${APP_BUILD})`,
        "",
        reportText || "(no details)",
      ].join("\n"),
    );
    window.location.href = `mailto:admin@t5.local?subject=${subject}&body=${body}`;
  }

  const tr = (key: MsgKey) => t(lang, key);

  return (
    <div className={`settings-panel ${embedded ? "embedded" : ""}`}>
      {screen !== "home" && (
        <button type="button" className="settings-back" onClick={() => setScreen("home")}>
          ← {tr("back")}
        </button>
      )}

      {screen === "home" && (
        <>
          <div className="settings-profile">
            {onClose && (
              <button type="button" className="settings-back inline" onClick={onClose}>
                ←
              </button>
            )}
            <div className="settings-avatar-wrap">
              <span className="settings-avatar">{initials(userName)}</span>
            </div>
            <strong>{userName}</strong>
            <small>{ORG_NAME}</small>
            <span className="settings-project-chip">{PROJECT_NAME}</span>
            <em>{userRole}</em>
          </div>

          <section className="settings-block">
            <h3>{lang === "zh" ? "工作台" : "Workspace"}</h3>
            {onOpenHistory && (
              <button type="button" className="settings-row" onClick={onOpenHistory}>
                <span className="settings-ico">◷</span>
                <span>{tr("history")}</span>
                <b>›</b>
              </button>
            )}
            {onOpenManpower && (
              <button type="button" className="settings-row" onClick={onOpenManpower}>
                <span className="settings-ico">♙</span>
                <span>{tr("manpower")}</span>
                <b>›</b>
              </button>
            )}
            <button type="button" className="settings-row" onClick={() => setScreen("projects")}>
              <span className="settings-ico">▣</span>
              <span>{tr("allProjects")}</span>
              <b>›</b>
            </button>
          </section>

          {isAdmin && (onOpenReports || onOpenUsers) && (
            <section className="settings-block">
              <h3>{tr("admin")}</h3>
              {onOpenReports && (
                <button type="button" className="settings-row" onClick={onOpenReports}>
                  <span className="settings-ico">◫</span>
                  <span>{tr("reports")}</span>
                  <b>›</b>
                </button>
              )}
              {onOpenUsers && (
                <button type="button" className="settings-row" onClick={onOpenUsers}>
                  <span className="settings-ico">♧</span>
                  <span>{tr("userAccess")}</span>
                  <b>›</b>
                </button>
              )}
            </section>
          )}

          <section className="settings-block">
            <h3>{tr("settings")}</h3>
            <button type="button" className="settings-row" onClick={() => setScreen("notifications")}>
              <span className="settings-ico">🔔</span>
              <span>{tr("notificationSettings")}</span>
              <b>›</b>
            </button>
            <button type="button" className="settings-row" onClick={() => setScreen("offline")}>
              <span className="settings-ico">⌀</span>
              <span>{tr("offlineMode")}</span>
              <b>›</b>
            </button>
            <button type="button" className="settings-row" onClick={() => setLangOpen(true)}>
              <span className="settings-ico">💬</span>
              <span>{tr("languages")}</span>
              <b>›</b>
            </button>
            <button type="button" className="settings-row" onClick={() => setScreen("gps")}>
              <span className="settings-ico">📍</span>
              <span>{tr("gpsLocation")}</span>
              <b>›</b>
            </button>
          </section>

          <section className="settings-block">
            <h3>{tr("support")}</h3>
            <button type="button" className="settings-row" onClick={() => setScreen("report")}>
              <span className="settings-ico">⚠</span>
              <span>{tr("reportIssue")}</span>
              <b>›</b>
            </button>
            <button type="button" className="settings-row" onClick={() => setScreen("help")}>
              <span className="settings-ico">?</span>
              <span>{tr("viewHelpCenter")}</span>
              <b>›</b>
            </button>
          </section>

          <button type="button" className="settings-signout" onClick={onSignOut}>
            {tr("signOut")}
          </button>
          <p className="settings-version">
            {APP_VERSION} ({APP_BUILD}) · ✓ {tr("upToDate")}
          </p>
        </>
      )}

      {screen === "notifications" && (
        <div className="settings-sub">
          <h2>{tr("notificationSettings")}</h2>
          <p className="settings-section-label">{tr("appPreferences")}</p>
          <div className="settings-card">
            <div className="settings-pref">
              <div>
                <strong>{tr("pushNotification")}</strong>
                <small>{tr("pushHint")}</small>
              </div>
              <Toggle checked={prefs.pushNotification} onChange={(pushNotification) => update({ pushNotification })} />
            </div>
            <div className="settings-pref">
              <div>
                <strong>{tr("inAppNotification")}</strong>
                <small>{tr("inAppHint")}</small>
              </div>
              <Toggle
                checked={prefs.inAppNotification}
                onChange={(inAppNotification) => update({ inAppNotification })}
              />
            </div>
            <div className="settings-pref muted-row">
              <div>
                <strong>{tr("manageInApp")}</strong>
                <small>{tr("manageInAppHint")}</small>
              </div>
              <b>›</b>
            </div>
          </div>
          <p className="settings-section-label">{tr("emailPreferences")}</p>
          <div className="settings-card">
            <div className="settings-pref">
              <div>
                <strong>{tr("email")}</strong>
                <small>{tr("emailHint")}</small>
              </div>
              <Toggle
                checked={prefs.emailNotification}
                onChange={(emailNotification) => update({ emailNotification })}
              />
            </div>
            <div className={`settings-pref muted-row ${prefs.emailNotification ? "" : "disabled"}`}>
              <div>
                <strong>{tr("manageEmail")}</strong>
                <small>{tr("manageEmailHint")}</small>
              </div>
              <b>›</b>
            </div>
          </div>
        </div>
      )}

      {screen === "gps" && (
        <div className="settings-sub">
          <h2>{tr("gpsLocation")}</h2>
          <div className="settings-card gps-card-settings">
            <div className="settings-pref">
              <div>
                <strong>{tr("locationTracking")}</strong>
              </div>
              <Toggle
                checked={prefs.locationTracking}
                onChange={(locationTracking) => update({ locationTracking })}
              />
            </div>
            <p className="settings-copy">{tr("locationHint")}</p>
            <button type="button" className="settings-outline-btn" onClick={openDeviceSettings}>
              {tr("openDeviceSettings")}
            </button>
          </div>
        </div>
      )}

      {screen === "offline" && (
        <div className="settings-sub">
          <h2>{tr("offlineMode")}</h2>
          <div className="settings-card gps-card-settings">
            <div className="settings-pref">
              <div>
                <strong>{tr("offlineMode")}</strong>
                <small className="ready-text">✓ {tr("offlineReady")}</small>
              </div>
              <Toggle checked={prefs.offlineMode} onChange={(offlineMode) => update({ offlineMode })} />
            </div>
            <p className="settings-copy">{tr("offlineHint")}</p>
          </div>
        </div>
      )}

      {screen === "projects" && (
        <div className="settings-sub">
          <h2>{tr("allProjects")}</h2>
          <div className="settings-card projects-card">
            <div className="projects-head">
              <strong>
                {tr("projects")} (1)
              </strong>
              <button type="button" onClick={() => setScreen("offline")}>
                ⚙ {tr("offlineMode")}
              </button>
            </div>
            <div className="project-row">
              <div>
                <strong>{PROJECT_NAME}</strong>
                <small className="ready-text">☁ ✓ {tr("offlineReady")}</small>
              </div>
              <span className="star">☆</span>
            </div>
          </div>
        </div>
      )}

      {screen === "help" && (
        <div className="settings-sub">
          <h2>{tr("helpTitle")}</h2>
          <div className="settings-card">
            <p className="settings-copy">{tr("helpBody")}</p>
          </div>
        </div>
      )}

      {screen === "report" && (
        <div className="settings-sub">
          <h2>{tr("reportTitle")}</h2>
          <div className="settings-card gps-card-settings">
            <p className="settings-copy">{tr("reportHint")}</p>
            <textarea
              value={reportText}
              onChange={(event) => setReportText(event.target.value)}
              rows={5}
              placeholder={lang === "zh" ? "请描述问题…" : "Describe the issue…"}
            />
            <button type="button" className="primary-button" onClick={sendReport}>
              {tr("reportSend")}
            </button>
          </div>
        </div>
      )}

      {langOpen && (
        <div className="lang-modal-backdrop" onClick={() => setLangOpen(false)}>
          <div className="lang-modal" onClick={(event) => event.stopPropagation()}>
            <div className="lang-modal-head">
              <h3>{tr("languages")}</h3>
              <button type="button" onClick={() => setLangOpen(false)}>
                ×
              </button>
            </div>
            <button
              type="button"
              className={`lang-option ${prefs.language === "en" ? "selected" : ""}`}
              onClick={() => setLanguage("en")}
            >
              <strong>{tr("english")}</strong>
              <small>{tr("englishSub")}</small>
              {prefs.language === "en" && <b>✓</b>}
            </button>
            <button
              type="button"
              className={`lang-option ${prefs.language === "zh" ? "selected" : ""}`}
              onClick={() => setLanguage("zh")}
            >
              <strong>{tr("chinese")}</strong>
              <small>{tr("chineseSub")}</small>
              {prefs.language === "zh" && <b>✓</b>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
