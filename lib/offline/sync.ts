"use client";

import { apiRequest } from "@/lib/http";
import { isFirebaseStorageConfigured, uploadAttendancePhotoResumable } from "@/lib/firebase/storage";
import { compressImageToLimit } from "@/lib/media/image";
import {
  enqueuePunch,
  listPendingPunches,
  pruneSyncedPhotos,
  updatePunch,
} from "@/lib/offline/store";

export type PunchInput = {
  workerId: string;
  action: "IN" | "OUT";
  remarks?: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  photoDataUrl: string;
};

async function uploadPhoto(localId: string, blob: Blob): Promise<string> {
  if (isFirebaseStorageConfigured()) {
    const path = `attendance/${new Date().toISOString().slice(0, 10)}/${localId}.jpg`;
    return uploadAttendancePhotoResumable(localId, blob, path, async (progress) => {
      await updatePunch(localId, {
        uploadBytesSent: progress.bytesTransferred,
        syncStatus: "uploading",
      });
    });
  }

  // Fallback when Firebase env is not set: server stores file under /api/uploads
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read photo"));
    reader.readAsDataURL(blob);
  });
  const result = await apiRequest<{ url: string }>("/api/uploads/attendance", {
    method: "POST",
    body: { dataUrl, localId },
    retries: 2,
  });
  return result.url;
}

async function syncOne(localId: string) {
  const pending = await listPendingPunches();
  const punch = pending.find((row) => row.id === localId);
  if (!punch) return;

  await updatePunch(localId, { syncStatus: "uploading", syncError: undefined });

  try {
    let photoUrl = punch.photoUrl;
    if (!photoUrl) {
      photoUrl = await uploadPhoto(localId, punch.photoBlob);
      await updatePunch(localId, { photoUrl });
    }

    const result = await apiRequest<{ record: { id: number } }>("/api/attendance", {
      method: "POST",
      body: {
        workerId: punch.workerId,
        action: punch.action,
        remarks: punch.remarks,
        photoUrl,
        latitude: punch.latitude,
        longitude: punch.longitude,
        accuracyM: punch.accuracyM,
        clientLocalId: punch.id,
      },
      retries: 2,
    });

    await updatePunch(localId, {
      syncStatus: "synced",
      serverRecordId: result.record.id,
      syncError: undefined,
      // Keep a tiny placeholder blob marker? Keep blob until prune.
    });
    await pruneSyncedPhotos(500);
  } catch (error) {
    await updatePunch(localId, {
      syncStatus: "failed",
      syncError: error instanceof Error ? error.message : "Sync failed",
    });
    throw error;
  }
}

/** Queue punch locally, then attempt immediate sync. */
export async function submitPunchWithOffline(input: PunchInput) {
  const compressed = await compressImageToLimit(input.photoDataUrl);
  const punch = await enqueuePunch({
    workerId: input.workerId,
    action: input.action,
    remarks: input.remarks?.trim() || "",
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyM: input.accuracyM,
    photoBlob: compressed.blob,
    photoMime: compressed.mime,
  });

  try {
    await syncOne(punch.id);
    return { queued: false, localId: punch.id };
  } catch {
    return { queued: true, localId: punch.id };
  }
}

let syncing = false;

/** Flush all pending/failed punches (call on app boot + online). */
export async function syncPendingPunches() {
  if (typeof window === "undefined" || syncing) return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const pending = await listPendingPunches();
    for (const punch of pending) {
      try {
        await syncOne(punch.id);
        synced += 1;
      } catch {
        failed += 1;
      }
    }
    await pruneSyncedPhotos(500);
  } finally {
    syncing = false;
  }
  return { synced, failed };
}
