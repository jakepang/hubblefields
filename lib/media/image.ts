"use client";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB

/** Compress image File/Blob/dataURL to JPEG ≤ 2MB. */
export async function compressImageToLimit(
  source: Blob | string,
  maxBytes = MAX_BYTES,
): Promise<{ blob: Blob; dataUrl: string; mime: string }> {
  const blob =
    typeof source === "string" ? await (await fetch(source)).blob() : source;

  const bitmap = await createImageBitmap(blob);
  let width = bitmap.width;
  let height = bitmap.height;
  let quality = 0.82;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to compress image");

  async function encode(w: number, h: number, q: number) {
    canvas.width = w;
    canvas.height = h;
    ctx!.drawImage(bitmap, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
    if (!out) throw new Error("Image encode failed");
    return out;
  }

  let result = await encode(width, height, quality);
  while (result.size > maxBytes && (quality > 0.45 || width > 640)) {
    if (quality > 0.45) {
      quality -= 0.08;
    } else {
      width = Math.round(width * 0.85);
      height = Math.round(height * 0.85);
    }
    result = await encode(width, height, quality);
  }

  bitmap.close();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read compressed image"));
    reader.readAsDataURL(result);
  });

  return { blob: result, dataUrl, mime: "image/jpeg" };
}

export async function pickFromGallery(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

export async function pickFromCamera(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}
