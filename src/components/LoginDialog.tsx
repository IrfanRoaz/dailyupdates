"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { useApp } from "./AppProvider";
import { getInput } from "@/lib/forms";

export function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Clear any error left over from the last attempt, and focus the
      // email field — a reset-on-open, not state derived from props.
      // The timeout waits one tick so the ref points at the freshly
      // rendered input before we focus it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      setTimeout(() => emailRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    const email = getInput(e, "email")?.value.trim() ?? "";
    const password = getInput(e, "password")?.value ?? "";

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
    <Modal open={open} onClose={onClose}>
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
    </Modal>
  );
}
