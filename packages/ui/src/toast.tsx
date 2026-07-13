"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

type Tone = "neutral" | "positive" | "danger";

interface ToastRecord {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastContextValue {
  show: (message: string, opts?: { tone?: Tone }) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

const toneClasses: Record<Tone, string> = {
  neutral: "text-ink",
  positive: "text-positive",
  danger: "text-danger",
};

/** Wrap the app once; call `useToast().show(...)` anywhere beneath it. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const nextId = React.useRef(0);
  // The portal target (document.body) only exists client-side; deferring to an
  // effect keeps the first client render matching the server's null output —
  // checking `typeof document` directly in render would mismatch during hydration.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const dismiss = React.useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = React.useCallback(
    (message: string, opts?: { tone?: Tone }) => {
      const id = nextId.current++;
      setToasts((cur) => [...cur, { id, message, tone: opts?.tone ?? "neutral" }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div
              aria-live="polite"
              aria-atomic="false"
              className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4"
            >
              {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: () => void }) {
  const dragStartX = React.useRef<number | null>(null);
  const [dragX, setDragX] = React.useState(0);

  return (
    <div
      role="status"
      style={{ transform: dragX ? `translateX(${dragX}px)` : undefined, opacity: dragX ? Math.max(1 - Math.abs(dragX) / 120, 0.2) : undefined }}
      onPointerDown={(e) => {
        dragStartX.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (dragStartX.current === null) return;
        setDragX(e.clientX - dragStartX.current);
      }}
      onPointerUp={() => {
        if (Math.abs(dragX) > 80) onDismiss();
        else setDragX(0);
        dragStartX.current = null;
      }}
      className={cn(
        "pointer-events-auto max-w-sm rounded-full border border-ink/5 bg-surface px-5 py-3 text-sm font-medium shadow-lifted",
        "supports-[backdrop-filter]:bg-surface/80 supports-[backdrop-filter]:backdrop-blur-2xl supports-[backdrop-filter]:backdrop-saturate-150",
        "motion-safe:animate-toast-in touch-none",
        toneClasses[toast.tone],
      )}
    >
      {toast.message}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
