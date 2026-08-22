# Status Dashboard — System Overview

## Purpose
A static web page showing, at a glance, what's being worked on: today's PDF report (with full history), the current focus domains, and what's coming up next. Reports are read in-browser without downloading anything or needing an account.

## Stack
- **Vanilla JS** — no framework, no build step.
- **Hand-written CSS** replicating the WordPress admin (wp-admin) look — colors, metrics, and component classes (`.postbox`, `.wp-list-table`, `.row-actions`, `.notice`) taken from core, set in **Inter** (Google Fonts) at larger sizes/weights than stock wp-admin for readability.
- **Supabase** (via `@supabase/supabase-js` CDN build) — hosted Postgres, Auth, and Storage for the PDFs.

## Files
| File | Purpose |
|---|---|
| `index.html` | Page structure — admin bar, nav, and the three screens. |
| `app.js` | Supabase client, data fetch, rendering, admin login, all write handlers. |
| `style.css` | The wp-admin visual replica. |
| `final-setup.sql` | The complete, current database setup. Run this on any project state. |
| `grant-admin.sql` | Grants one email admin rights, after that user is created in Supabase Auth. |

> **Naming gotcha:** the Supabase UMD bundle defines a global called `supabase`. Declaring `const supabase` in `app.js` throws `Identifier 'supabase' has already been declared`, which kills the entire file and leaves a blank, unscripted page. The client is therefore named **`db`**.

## Screens
Three, routed by URL hash so refresh and Back both work.

**`#today`** — the main screen. The "Today" heading and the day selector share one line:
- A **dropdown** lists every day that has a report, plus today, newest first.
- Admins additionally get a native **date input** next to it to jump to *any* date — including ones with no report yet — so a PDF can be uploaded or an existing one replaced for any day, not just recent ones.
- **Today's Work** — the selected day's PDF, rendered inline in an `<iframe>`, with an "open in new tab" fallback. Admins get upload/replace/remove controls here.
- **History** — every uploaded PDF across every day, newest first; clicking a row jumps to that day.

**`#domains`** — "Current Domains": the areas currently being worked on, each with an optional note. Add / edit / delete when logged in as admin — same list pattern as Upcoming.

**`#upcoming`** — a `wp-list-table` of what's next. Add / edit / delete when logged in as admin.

The default view is fully read-only — no inputs, no upload form, no row-actions render into the DOM at all for a signed-out visitor.

## Navigation
There is **no sidebar**. One `#adminmenuwrap` element renders two ways:
- **Desktop (>782px)** — a horizontal top bar fixed under the admin bar; current tab is a blue block with a light-blue bottom underline.
- **Mobile (≤782px)** — the same element becomes a sticky bottom tab bar; icon over label, tinted current tab with a top-edge underline, and `env(safe-area-inset-bottom)` padding for the iOS home indicator.

No hamburger, no drawer — every screen is one click/tap away in both layouts.

## Data Model
Defined in `final-setup.sql`.

| table | columns |
|---|---|
| `day_reports` | `day` date **PK**, `pdf_path` text, `file_name` text, `uploaded_at` |
| `domains` | `id` uuid, `name`, `note`, `sort_order` int, `created_at` |
| `upcoming_tasks` | `id` uuid, `title`, `notes`, `sort_order` int, `created_at` |
| `dashboard_meta` | `id` smallint (singleton), `updated_at` — feeds the admin bar only |
| `admins` | `user_id` uuid → `auth.users` — the write allowlist |

There is no work-log/checklist table — that screen (Work Log, Overall %, per-item History) was removed. History now just lists which days have a PDF, derived from `day_reports`.

Dates are handled in **local time (Asia/Karachi, UTC+5)**, not UTC — both client-side (`todayISO()` builds from local getters) and server-side (`public.local_today()` in `final-setup.sql`), so "today" doesn't shift five hours early against Postgres's UTC `current_date`.

`dashboard_meta.updated_at` maintains itself via `AFTER ... FOR EACH ROW` triggers.

> **These triggers must stay `FOR EACH ROW`.** A statement-level trigger fires even when a statement affects zero rows. RLS rejects non-admin writes by *filtering rows out*, not by erroring, so an anonymous visitor could send a no-op `DELETE` and still fire the trigger — which is `SECURITY DEFINER` and bypasses RLS — bumping the public "Last updated" timestamp. This was a real, verified bug; the fix and the reasoning are inlined as a comment in `final-setup.sql`.

## PDF reports
- Stored in the Supabase Storage bucket **`reports`**, one object per day, named `YYYY-MM-DD.pdf`.
- The bucket is **public-read**, so the boss needs no account and no login to view a report.
- Uploads/replacements/deletes are gated on `is_admin()` via policies on `storage.objects`.
- Client-side guards before upload: must be `application/pdf`, must be under 25 MB.
- Rendered with a plain `<iframe>` — the browser's own PDF viewer, no library.
- Any date can carry a report: admins pick it via the date input next to the day dropdown, then upload — including replacing a day that already has one.

> **Cache-busting:** the object path is stable per day, and storage public URLs are CDN-cached. Re-uploading a day's report would otherwise keep serving the old file, so the viewer URL carries `?v=<uploaded_at>`, which changes on every upsert.

## Admin / Editing
Two independent gates:

**1. Authentication** — Supabase Auth email/password. `onAuthStateChange` drives the UI, so a restored session unlocks editing on reload.

**2. Authorization** — being logged in is *not* enough. This project has **public sign-up enabled**, so anyone could create an account. Writes are granted only to user ids in the `admins` table, checked by the `SECURITY DEFINER` function `public.is_admin()`.

RLS on every content table: `SELECT` for `anon` + `authenticated` with `using (true)`; `INSERT`/`UPDATE`/`DELETE` for `authenticated` only, gated on `is_admin()`. The `admins` table itself has RLS on and **no policies**, so no client can read or modify the allowlist — it's managed only from the SQL editor.

After login the app calls the `is_admin` RPC; a non-admin account is signed straight back out with an explanatory message, so the UI never offers controls the database would reject.

**Verified by direct API probe** with the anon key: `INSERT` is refused with `42501 new row violates row-level security policy`; `UPDATE`/`DELETE` return success but affect zero rows — confirmed by re-reading the tables and finding them unchanged.

### Write behaviour
Every mutation writes to Supabase first, then re-reads all data before re-rendering, so the screen always reflects what the database accepted. A failed write shows a WP-style error notice and rolls the UI back to server state.

## Status
Live and connected — `final-setup.sql` has been run; `domains` and `upcoming_tasks` are populated and rendering from the real database (verified via screenshot).

**Remaining setup:**
1. Supabase → Authentication → Users → Add user, **tick "Auto Confirm User"** (`mailer_autoconfirm = false` on this project, so without it the account cannot log in).
2. Run `grant-admin.sql` with that email (or the matching snippet at the bottom of `final-setup.sql`).

Until then, login succeeds but is rejected as "not an admin" — intended behaviour, not a bug.

### Known gaps
- **The admin write path is still untested end-to-end** — no admin account exists yet, so PDF upload/replace/remove and domain/upcoming add/edit/delete have not been exercised against the live database. Only the public read path and the auth-rejection path are verified.
- iOS Safari renders PDFs in an `<iframe>` poorly (often first page only); the "open in a new tab" fallback link exists for that case.
- No reordering UI — `sort_order` is set on insert and never changed.
- Nav icons are hand-drawn SVGs shaped like Dashicons; no reliable Dashicons CDN exists.
