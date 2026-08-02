export type SyncStatus = "pending" | "uploading" | "synced" | "failed";

export type OfflinePunch = {
  id: string;
  workerId: string;
  action: "IN" | "OUT";
  remarks: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  photoBlob: Blob;
  photoMime: string;
  photoUrl?: string;
  uploadBytesSent?: number;
  syncStatus: SyncStatus;
  syncError?: string;
  serverRecordId?: number;
  createdAt: number;
  updatedAt: number;
};

export const OFFLINE_DB_NAME = "t5-offline-v1";
export const OFFLINE_STORE = "punches";
export const MAX_SYNCED_PHOTOS = 500;
