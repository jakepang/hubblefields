"use client";

import { useEffect, useState } from "react";
import { countOfflineByStatus } from "@/lib/offline/store";
import { syncPendingPunches } from "@/lib/offline/sync";

/** Boots offline sync on app start + when network returns. */
export function OfflineSyncBootstrap({ onSynced }: { onSynced?: () => void }) {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refreshCount() {
      try {
        const counts = await countOfflineByStatus();
        if (!cancelled) setPending(counts.pending + counts.uploading);
      } catch {
        /* ignore */
      }
    }

    async function runSync() {
      try {
        const result = await syncPendingPunches();
        await refreshCount();
        if (!cancelled && result.synced > 0) onSynced?.();
      } catch {
        await refreshCount();
      }
    }

    void refreshCount();
    void runSync();

    const onOnline = () => void runSync();
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => void runSync(), 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [onSynced]);

  if (pending <= 0) return null;
  return (
    <div className="offline-sync-banner" role="status">
      Syncing {pending} offline punch{pending === 1 ? "" : "es"}…
    </div>
  );
}
