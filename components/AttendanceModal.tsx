"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SITE_ADDRESS, SITE_CENTER, SITE_LABEL, activeSitePolygon, isInsideSite, siteRadiusM } from "@/lib/site";
import { compressImageToLimit, pickFromGallery } from "@/lib/media/image";
import { loadPrefs } from "@/lib/prefs";

const SiteMap = dynamic(() => import("@/components/SiteMap").then((mod) => mod.SiteMap), {
  ssr: false,
  loading: () => <div className="site-map site-map-loading">Loading map…</div>,
});

type Worker = {
  id?: number;
  workerId: string;
  name: string;
  company: string;
  trade: string;
  status?: "Active" | "Inactive";
};

type GpsState = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
};

type Props = {
  action: "IN" | "OUT";
  workers: Worker[];
  saving: boolean;
  error: string;
  initialWorkerId?: string | null;
  emptyLabel?: string;
  recorderName?: string;
  onClose: () => void;
  onSubmit: (payload: {
    workerId: string;
    remarks: string;
    photoDataUrl: string;
    latitude: number;
    longitude: number;
    accuracyM: number | null;
  }) => Promise<void>;
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

async function compressFrame(video: HTMLVideoElement): Promise<string> {
  const maxWidth = 960;
  const scale = Math.min(1, maxWidth / Math.max(video.videoWidth || maxWidth, 1));
  const width = Math.max(1, Math.round((video.videoWidth || maxWidth) * scale));
  const height = Math.max(1, Math.round((video.videoHeight || 720) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to capture photo");
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function AttendanceModal({
  action,
  workers,
  saving,
  error,
  initialWorkerId,
  emptyLabel,
  recorderName,
  onClose,
  onSubmit,
}: Props) {
  const preselected = initialWorkerId
    ? workers.find((worker) => worker.workerId === initialWorkerId) || null
    : null;
  const [step, setStep] = useState<"select" | "location" | "photo">(preselected ? "location" : "select");
  const [query, setQuery] = useState("");
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(preselected);
  const [remarks, setRemarks] = useState("");
  const [gps, setGps] = useState<GpsState | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bootstrapped = useRef(false);

  const site = useMemo(
    () => ({
      latitude: SITE_CENTER.lat,
      longitude: SITE_CENTER.lng,
      radiusM: siteRadiusM(),
      polygon: activeSitePolygon(),
      label: SITE_LABEL,
      address: SITE_ADDRESS,
    }),
    [],
  );

  const locationStatus = gps
    ? isInsideSite(gps.latitude, gps.longitude)
    : null;

  const matches = workers
    .filter(
      (worker) =>
        !query.trim() ||
        `${worker.name} ${worker.workerId} ${worker.trade}`.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .slice(0, 12);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  useEffect(() => () => stopCamera(), []);

  async function requestGps() {
    const prefs = loadPrefs();
    if (!prefs.locationTracking) {
      setGpsError(
        prefs.language === "zh"
          ? "已关闭位置追踪。请在设置 → GPS 定位中重新开启。"
          : "Location tracking is off. Enable it in Settings → GPS Location.",
      );
      return null;
    }
    setGpsLoading(true);
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("This device does not support GPS");
      setGpsLoading(false);
      return null;
    }
    return new Promise<GpsState | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          };
          setGps(next);
          setGpsLoading(false);
          resolve(next);
        },
        (err) => {
          setGpsError(err.code === 1 ? "Allow location access to continue" : "Unable to read GPS. Try again outdoors.");
          setGpsLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
      );
    });
  }

  async function startCamera() {
    setCameraError("");
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not available in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setCameraError("Allow camera access to capture site evidence");
    }
  }

  async function goToLocation(worker = selectedWorker) {
    if (!worker) return;
    setSelectedWorker(worker);
    setStep("location");
    setPhotoDataUrl("");
    stopCamera();
    await requestGps();
  }

  async function goToPhoto() {
    if (!selectedWorker || !gps) return;
    setStep("photo");
    setPhotoDataUrl("");
    await startCamera();
  }

  useEffect(() => {
    if (!preselected || bootstrapped.current) return;
    bootstrapped.current = true;
    void goToLocation(preselected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function capturePhoto() {
    if (!videoRef.current) return;
    try {
      const dataUrl = await compressFrame(videoRef.current);
      const compressed = await compressImageToLimit(dataUrl);
      setPhotoDataUrl(compressed.dataUrl);
      stopCamera();
    } catch {
      setCameraError("Photo capture failed. Try again.");
    }
  }

  async function chooseFromAlbum() {
    try {
      const file = await pickFromGallery();
      if (!file) return;
      const compressed = await compressImageToLimit(file);
      setPhotoDataUrl(compressed.dataUrl);
      stopCamera();
      setCameraError("");
    } catch {
      setCameraError("Unable to read photo from album");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorker || !gps || !photoDataUrl) return;
    await onSubmit({
      workerId: selectedWorker.workerId,
      remarks,
      photoDataUrl,
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracyM: gps.accuracyM,
    });
  }

  const nowLabel = new Date().toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="modal-backdrop">
      <form className={`modal attendance-modal step-${step}`} onSubmit={handleSubmit}>
        <button
          type="button"
          className="modal-close"
          onClick={() => {
            stopCamera();
            onClose();
          }}
        >
          ×
        </button>
        <p className="eyebrow">{action === "IN" ? "WORKER ARRIVAL" : "WORKER DEPARTURE"}</p>
        <h2>
          {step === "select" && (action === "IN" ? "Check in worker" : "Check out worker")}
          {step === "location" && "Location"}
          {step === "photo" && "Site photo"}
        </h2>
        <p>
          {step === "select" &&
            (action === "OUT" ? "Choose someone currently onsite." : "Search by name, ID last four or trade.")}
          {step === "location" && "Confirm your GPS position against the T5 site boundary."}
          {step === "photo" && "Capture a clear site photo before submitting."}
        </p>
        {error && <p className="form-error">{error}</p>}

        {step === "select" && (
          <>
            <label>
              Search worker
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedWorker(null);
                }}
                placeholder="Type name, last four or trade"
              />
            </label>
            <div className="attendance-picker">
              {matches.map((worker) => (
                <button
                  type="button"
                  key={worker.workerId}
                  className={selectedWorker?.workerId === worker.workerId ? "selected" : ""}
                  onClick={() => setSelectedWorker(worker)}
                >
                  <i>{initials(worker.name)}</i>
                  <span>
                    <strong>{worker.name}</strong>
                    <small>
                      {worker.workerId.slice(-4)} · {worker.trade}
                    </small>
                  </span>
                  <b>{selectedWorker?.workerId === worker.workerId ? "✓" : "›"}</b>
                </button>
              ))}
              {!matches.length && (
                <div className="empty-state">
                  <strong>{emptyLabel || "No worker found"}</strong>
                  <span>
                    {action === "OUT"
                      ? "Nobody is currently onsite, or try another search."
                      : "Try another name, last four or trade."}
                  </span>
                </div>
              )}
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={!selectedWorker}
              onClick={() => void goToLocation()}
            >
              {selectedWorker ? `Continue with ${selectedWorker.name}` : "Select a worker"}
            </button>
          </>
        )}

        {step === "location" && selectedWorker && (
          <>
            <div className="location-map-wrap">
              <SiteMap
                mode="dark"
                site={site}
                user={
                  gps
                    ? { latitude: gps.latitude, longitude: gps.longitude, accuracyM: gps.accuracyM }
                    : null
                }
              />
              <button
                type="button"
                className="locate-fab"
                onClick={() => void requestGps()}
                disabled={gpsLoading}
                aria-label="Refresh my location"
              >
                ⌖
              </button>
            </div>

            <div className={`location-status ${locationStatus?.inside ? "ok" : locationStatus ? "bad" : ""}`}>
              {gpsLoading && <strong>Getting GPS…</strong>}
              {!gpsLoading && gps && locationStatus?.inside && <strong>Location verified · on site</strong>}
              {!gpsLoading && gps && locationStatus && !locationStatus.inside && (
                <strong>Outside site · {locationStatus.distanceM}m from pin</strong>
              )}
              {!gpsLoading && !gps && <strong>{gpsError || "Waiting for GPS"}</strong>}
            </div>

            <div className="location-card">
              <div className="location-card-row">
                <span className="loc-icon">▣</span>
                <div>
                  <strong>{site.label}</strong>
                  <small>{site.address}</small>
                </div>
              </div>
              <div className="location-card-row">
                <span className="loc-icon">◷</span>
                <div>
                  <strong>{nowLabel}</strong>
                  <small>Local time</small>
                </div>
              </div>
              <div className="location-card-row">
                <span className="loc-icon">♙</span>
                <div>
                  <strong>{selectedWorker.name.toUpperCase()}</strong>
                  <small>
                    {selectedWorker.workerId.slice(-4)} · {selectedWorker.trade}
                    {recorderName ? ` · by ${recorderName}` : ""}
                  </small>
                </div>
              </div>
              {gps && (
                <div className="location-card-row">
                  <span className="loc-icon">◎</span>
                  <div>
                    <strong>
                      {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                    </strong>
                    <small>
                      Your GPS
                      {gps.accuracyM != null ? ` · ±${Math.round(gps.accuracyM)}m` : ""}
                    </small>
                  </div>
                </div>
              )}
              <label className="location-remarks">
                Remarks (optional)
                <input
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  maxLength={300}
                  placeholder="Remarks (Optional)"
                />
              </label>
            </div>

            <div className="capture-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  if (initialWorkerId) onClose();
                  else setStep("select");
                }}
              >
                Back
              </button>
              <button
                type="button"
                className={`primary-button ${action === "IN" ? "checkin-green" : ""}`}
                disabled={!gps || gpsLoading}
                onClick={() => void goToPhoto()}
              >
                {action === "IN" ? "Check In" : "Check Out"}
              </button>
            </div>
          </>
        )}

        {step === "photo" && selectedWorker && (
          <>
            <div className="capture-worker">
              <strong>{selectedWorker.name}</strong>
              <span>
                {selectedWorker.workerId.slice(-4)} · {selectedWorker.trade}
                {gps ? ` · ${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : ""}
              </span>
            </div>

            <div className="camera-stage">
              {!photoDataUrl ? (
                <>
                  <video ref={videoRef} playsInline muted autoPlay className={cameraReady ? "live" : ""} />
                  {!cameraReady && !cameraError && <div className="camera-placeholder">Starting camera…</div>}
                  {cameraError && <div className="camera-placeholder bad">{cameraError}</div>}
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoDataUrl} alt="Attendance evidence" />
              )}
            </div>

            <div className="capture-actions">
              {!photoDataUrl ? (
                <>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      stopCamera();
                      setStep("location");
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void chooseFromAlbum()}
                  >
                    Album
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!cameraReady || !gps}
                    onClick={() => void capturePhoto()}
                  >
                    Capture
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setPhotoDataUrl("");
                      void startCamera();
                    }}
                  >
                    Retake
                  </button>
                  <button className={`primary-button ${action === "IN" ? "checkin-green" : ""}`} disabled={saving || !gps}>
                    {saving
                      ? "Saving…"
                      : `${action === "IN" ? "Submit check in" : "Submit check out"}`}
                  </button>
                </>
              )}
            </div>
            {cameraError && photoDataUrl === "" && (
              <button type="button" className="text-link" onClick={() => void startCamera()}>
                Retry camera
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
}
