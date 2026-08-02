const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const MAX_BYTES = 2_100_000; // allow up to ~2MB after client compression

export function parseAttendancePhoto(input: unknown): { mime: string; base64: string; dataUrl: string } | null {
  if (typeof input !== "string" || !input.startsWith("data:image/")) return null;
  const match = DATA_URL_RE.exec(input);
  if (!match) return null;
  const mime = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
  const base64 = input.slice(match[0].length).replace(/\s/g, "");
  if (!base64 || base64.length > MAX_BYTES * 1.4) return null;
  try {
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length < 800 || bytes.length > MAX_BYTES) return null;
  } catch {
    return null;
  }
  return {
    mime: `image/${mime}`,
    base64,
    dataUrl: `data:image/${mime};base64,${base64}`,
  };
}

export function photoBufferFromDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const parsed = parseAttendancePhoto(dataUrl);
  if (!parsed) return null;
  return { mime: parsed.mime, buffer: Buffer.from(parsed.base64, "base64") };
}

/** Accept Firebase https URLs or local /api/uploads paths. */
export function parseAttendancePhotoUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value || value.length > 2048) return null;
  if (value.startsWith("/api/uploads/attendance/")) {
    if (!/^\/api\/uploads\/attendance\/[a-zA-Z0-9._-]+\.jpe?g$/i.test(value)) return null;
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
