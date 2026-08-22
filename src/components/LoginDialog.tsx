"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApp } from "./AppProvider";

export function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Clear any error left over from the last attempt, and focus the
      // email field — a reset-on-open, not state derived from props.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      setTimeout(() => emailRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const err = await login(email, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    form.reset();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div id="login">
        <div className="login-logo" aria-hidden="true">
          P
        </div>
        <form id="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">
            Email Address
            <input
              ref={emailRef}
              id="login-email"
              name="email"
              type="email"
              className="input"
              required
              autoComplete="username"
            />
          </label>
          <label htmlFor="login-password">
            Password
            <input
              id="login-password"
              name="password"
              type="password"
              className="input"
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p className="error-msg">{error}</p>}
          <p className="submit">
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button-primary button-large" disabled={busy}>
              {busy ? "Logging in…" : "Log In"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
