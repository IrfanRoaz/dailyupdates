"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";
import { LoginDialog } from "./LoginDialog";

export function TopBar() {
  const { isAdmin, updatedAt, logout } = useApp();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <div id="wpadminbar">
        <a href="/today" className="ab-item ab-site" aria-label="Home">
          <span className="ab-house" aria-hidden="true">
            &#8962;
          </span>
        </a>
        <span className="ab-item ab-muted">
          Last updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
        </span>
        <span className="ab-spacer" />
        {isAdmin && <span className="ab-item ab-badge">Admin</span>}
        <button
          type="button"
          className="ab-item ab-link-btn"
          onClick={() => (isAdmin ? logout() : setLoginOpen(true))}
        >
          {isAdmin ? "Log Out" : "Log In"}
        </button>
      </div>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
