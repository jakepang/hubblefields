"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  type FirebaseStorage,
  type UploadTask,
} from "firebase/storage";

export type UploadProgress = {
  bytesTransferred: number;
  totalBytes: number;
  progress: number;
};

function firebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  if (!apiKey || !projectId || !storageBucket || !appId) return null;
  return {
    apiKey,
    authDomain: authDomain || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket,
    messagingSenderId: messagingSenderId || undefined,
    appId,
  };
}

export function isFirebaseStorageConfigured() {
  return Boolean(firebaseConfig());
}

let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;

function getFirebaseStorage() {
  const config = firebaseConfig();
  if (!config) return null;
  if (!app) {
    app = getApps()[0] || initializeApp(config);
    // asia-southeast1 (Singapore) bucket is selected via storageBucket name / URL
    storage = getStorage(app, `gs://${config.storageBucket}`);
  }
  return storage;
}

const activeTasks = new Map<string, UploadTask>();

/** Resumable upload to Firebase Storage (Singapore bucket via env). */
export async function uploadAttendancePhotoResumable(
  localId: string,
  blob: Blob,
  path: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  const store = getFirebaseStorage();
  if (!store) throw new Error("Firebase Storage is not configured");

  const objectRef = ref(store, path);
  const task = uploadBytesResumable(objectRef, blob, {
    contentType: blob.type || "image/jpeg",
    cacheControl: "private, max-age=31536000",
  });
  activeTasks.set(localId, task);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        onProgress?.({
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          progress: snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0,
        });
      },
      (error) => {
        activeTasks.delete(localId);
        reject(error);
      },
      async () => {
        activeTasks.delete(localId);
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      },
    );
  });
}

export function pauseUpload(localId: string) {
  activeTasks.get(localId)?.pause();
}

export function resumeUpload(localId: string) {
  activeTasks.get(localId)?.resume();
}
