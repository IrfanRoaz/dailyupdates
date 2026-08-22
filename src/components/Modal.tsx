"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Shared modal scaffolding: Escape-to-close, click-on-backdrop-to-close,
 * and the dialog semantics screen readers need. Renders nothing when closed.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** id of the element (usually the title heading) that names this dialog */
  labelledBy?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // Only close when the click lands on the backdrop itself, not bubbled
    // up from content inside the dialog.
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>
  );
}
