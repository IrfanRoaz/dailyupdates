"use client";

import { useApp } from "./AppProvider";

export function Notices() {
  const { notices, dismissNotice } = useApp();
  return (
    <div id="notices">
      {notices.map((n) => (
        <div key={n.id} className={`notice notice-${n.type} is-dismissible`}>
          <p>{n.message}</p>
          <button
            type="button"
            className="notice-dismiss"
            aria-label="Dismiss"
            onClick={() => dismissNotice(n.id)}
          />
        </div>
      ))}
    </div>
  );
}
