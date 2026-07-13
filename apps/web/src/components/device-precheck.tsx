"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ProgressBar, Select } from "@calm-point/ui";

interface Props {
  onReady: () => void;
  joining: boolean;
  joinLabel?: string;
}

/**
 * Pre-join device check: live camera preview + mic level meter + device
 * pickers, so a patient or provider can confirm their setup before a
 * clinical video visit rather than discovering a dead mic mid-appointment.
 * Never hard-blocks joining — permission or hardware failures show a
 * warning and let the visit proceed (the vendor SDK gets its own chance).
 */
export function DevicePrecheck({ onReady, joining, joinLabel = "Join now" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>("");
  const [micId, setMicId] = useState<string>("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  function stopAll() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  async function start(constraints: MediaStreamConstraints) {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stopAll();
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setReady(true);

      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((d) => d.kind === "videoinput"));
      setMics(devices.filter((d) => d.kind === "audioinput"));
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (videoTrack) setCameraId(videoTrack.getSettings().deviceId ?? "");
      if (audioTrack) setMicId(audioTrack.getSettings().deviceId ?? "");

      if (audioTrack) {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setLevel(Math.min(100, Math.round((avg / 128) * 100)));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }
    } catch (e) {
      setReady(false);
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Camera/mic access was blocked. You can still join, but check your browser permissions."
          : "Couldn't access a camera or microphone. You can still join with what's available.",
      );
    }
  }

  useEffect(() => {
    void start({ video: true, audio: true });
    return stopAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchDevice(next: { cameraId?: string; micId?: string }) {
    const camera = next.cameraId ?? cameraId;
    const mic = next.micId ?? micId;
    void start({
      video: camera ? { deviceId: { exact: camera } } : true,
      audio: mic ? { deviceId: { exact: mic } } : true,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-lg bg-ink/90">
        <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
        {!ready ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            {error ? "Camera preview unavailable" : "Starting camera…"}
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      ) : null}

      {cameras.length || mics.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {cameras.length ? (
            <Select
              label="Camera"
              value={cameraId}
              onChange={(e) => {
                setCameraId(e.target.value);
                switchDevice({ cameraId: e.target.value });
              }}
              options={cameras.map((c, i) => ({ value: c.deviceId, label: c.label || `Camera ${i + 1}` }))}
            />
          ) : null}
          {mics.length ? (
            <div className="flex flex-col gap-1.5">
              <Select
                label="Microphone"
                value={micId}
                onChange={(e) => {
                  setMicId(e.target.value);
                  switchDevice({ micId: e.target.value });
                }}
                options={mics.map((m, i) => ({ value: m.deviceId, label: m.label || `Microphone ${i + 1}` }))}
              />
              <ProgressBar value={level} label="Microphone level" />
            </div>
          ) : null}
        </div>
      ) : null}

      <Button
        size="lg"
        loading={joining}
        onClick={() => {
          stopAll();
          onReady();
        }}
        className="w-full"
      >
        {joinLabel}
      </Button>
    </div>
  );
}
