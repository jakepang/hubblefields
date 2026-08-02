export const APP_VERSION = "0.1.0";
export const APP_BUILD = "1";
export const ORG_NAME = "QI SHENG CONSTRUCTION PTE. LTD.";
export const PROJECT_NAME = "QI SHENG CONSTRUCTION PTE. LTD.";

export type AppLanguage = "en" | "zh";

export type AppPrefs = {
  language: AppLanguage;
  pushNotification: boolean;
  inAppNotification: boolean;
  emailNotification: boolean;
  locationTracking: boolean;
  offlineMode: boolean;
};

const STORAGE_KEY = "t5_app_prefs_v1";

export const DEFAULT_PREFS: AppPrefs = {
  language: "en",
  pushNotification: true,
  inAppNotification: true,
  emailNotification: false,
  locationTracking: true,
  offlineMode: true,
};

export function loadPrefs(): AppPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AppPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: AppPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
