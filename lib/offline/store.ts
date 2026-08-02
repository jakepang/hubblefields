"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  MAX_SYNCED_PHOTOS,
  OFFLINE_DB_NAME,
  OFFLINE_STORE,
  type OfflinePunch,
  type SyncStatus,
} from "@/lib/offline/types";

interface T5OfflineDb extends DBSchema {
  [OFFLINE_STORE]: {
    key: string;
    value: OfflinePunch;
    indexes: {
      "by-status": SyncStatus;
      "by-updated": number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<T5OfflineDb>> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("Offline store is browser-only");
  }
  if (!dbPromise) {
    dbPromise = openDB<T5OfflineDb>(OFFLINE_DB_NAME, 1, {
      upgrade(db) {
        const store = db.createObjectStore(OFFLINE_STORE, { keyPath: "id" });
        store.createIndex("by-status", "syncStatus");
        store.createIndex("by-updated", "updatedAt");
      },
    });
  }
  return dbPromise;
}

export async function enqueuePunch(
  input: Omit<OfflinePunch, "id" | "syncStatus" | "createdAt" | "updatedAt" | "uploadBytesSent">,
) {
  const db = await getDb();
  const now = Date.now();
  const punch: OfflinePunch = {
    ...input,
    id: `local_${now}_${Math.random().toString(36).slice(2, 9)}`,
    syncStatus: "pending",
    createdAt: now,
    updatedAt: now,
    uploadBytesSent: 0,
  };
  await db.put(OFFLINE_STORE, punch);
  return punch;
}

export async function updatePunch(id: string, patch: Partial<OfflinePunch>) {
  const db = await getDb();
  const current = await db.get(OFFLINE_STORE, id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: Date.now() };
  await db.put(OFFLINE_STORE, next);
  return next;
}

export async function listPendingPunches() {
  const db = await getDb();
  const all = await db.getAll(OFFLINE_STORE);
  return all
    .filter((row) => row.syncStatus === "pending" || row.syncStatus === "failed" || row.syncStatus === "uploading")
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function listSyncedPunches() {
  const db = await getDb();
  const all = await db.getAllFromIndex(OFFLINE_STORE, "by-status", "synced");
  return all.sort((a, b) => a.updatedAt - b.updatedAt);
}

/** Keep at most MAX_SYNCED_PHOTOS synced photo blobs; drop oldest synced first. */
export async function pruneSyncedPhotos(limit = MAX_SYNCED_PHOTOS) {
  const synced = await listSyncedPunches();
  if (synced.length <= limit) return 0;
  const db = await getDb();
  const overflow = synced.length - limit;
  const victims = synced.slice(0, overflow);
  for (const row of victims) {
    await db.delete(OFFLINE_STORE, row.id);
  }
  return victims.length;
}

export async function countOfflineByStatus() {
  const db = await getDb();
  const all = await db.getAll(OFFLINE_STORE);
  return {
    pending: all.filter((r) => r.syncStatus === "pending" || r.syncStatus === "failed").length,
    uploading: all.filter((r) => r.syncStatus === "uploading").length,
    synced: all.filter((r) => r.syncStatus === "synced").length,
    total: all.length,
  };
}
