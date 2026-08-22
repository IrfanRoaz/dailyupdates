"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/today",
    label: "Today",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M6 1v2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2V1h-1.5v2h-5V1H6zM4 7h12v9H4V7zm2 2v2h2V9H6zm3.5 0v2h2V9h-2z" />
      </svg>
    ),
  },
  {
    href: "/domains",
    label: "Domains",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
      </svg>
    ),
  },
  {
    href: "/upcoming",
    label: "Upcoming",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM9.25 5v5.5l4.2 2.5.75-1.3-3.45-2V5h-1.5z" />
      </svg>
    ),
  },
];

export function MainNav() {
  const pathname = usePathname();
  return (
    <div id="adminmenuwrap">
      <nav id="adminmenu" aria-label="Main menu">
        {TABS.map((tab) => {
          const current = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`menu-item${current ? " current" : ""}`}
              aria-current={current ? "page" : undefined}
            >
              <span className="wp-menu-image" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="wp-menu-name">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
