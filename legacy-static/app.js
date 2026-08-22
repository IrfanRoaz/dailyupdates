// ===== Config =====
// NOTE: the Supabase UMD bundle already defines a global named `supabase`.
// Declaring `const supabase` here would throw
//   "Identifier 'supabase' has already been declared"
// and kill the whole file. The client is therefore named `db`.
const SUPABASE_URL = "https://qlhqrluogpdpqloaqoqa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsaHFybHVvZ3BkcHFsb2Fxb3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MjA1NzYsImV4cCI6MjEwMjk5NjU3Nn0.x9bxZSuKxBmnXsxGNtUGxY2I1J6-MWrPAMr1KG_hnMc";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "reports";

// ===== State =====
let state = {
  meta: { updated_at: null },
  reports: {},        // day -> { pdf_path, file_name, uploaded_at }
  upcoming: [],
  domains: [],
};
let isAdmin = false;
let selectedDay = todayISO();

const $ = (id) => document.getElementById(id);

// ===== Dates =====
// Local-date based, not UTC — "today" must mean the user's today.
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDay(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function formatDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function relativeDay(iso) {
  const today = todayISO();
  if (iso === today) return "Today";
  if (iso === shiftDay(today, -1)) return "Yesterday";
  if (iso === shiftDay(today, 1)) return "Tomorrow";
  return "";
}

// ===== Notices =====
function notice(message, type = "success") {
  const el = document.createElement("div");
  el.className = `notice notice-${type} is-dismissible`;
  el.innerHTML = `<p></p><button type="button" class="notice-dismiss" aria-label="Dismiss"></button>`;
  el.querySelector("p").textContent = message;
  el.querySelector(".notice-dismiss").addEventListener("click", () => el.remove());
  $("notices").appendChild(el);
  if (type === "success") setTimeout(() => el.remove(), 4000);
}

function fail(context, error) {
  console.error(context, error);
  notice(`${context}: ${error?.message || "unknown error"}`, "error");
}

// ===== Data =====
// Each table is fetched independently, and one missing/broken table does
// NOT block the rest of the page — e.g. if `domains` hasn't been migrated
// in yet, Today/Upcoming/Progress should still render normally, and only
// the Domains screen shows its own "not set up yet" state.
async function loadData() {
  const [metaRes, reportRes, upRes, domRes] = await Promise.all([
    db.from("dashboard_meta").select("updated_at").eq("id", 1).maybeSingle(),
    db.from("day_reports").select("*"),
    db.from("upcoming_tasks").select("*").order("sort_order"),
    db.from("domains").select("*").order("sort_order"),
  ]);

  state.meta = metaRes.data || { updated_at: null };
  state.upcoming = upRes.data || [];
  state.domains = domRes.data || [];
  state.reports = {};
  (reportRes.data || []).forEach((r) => (state.reports[r.day] = r));

  const missing = [reportRes.error, upRes.error, domRes.error].some(
    (e) => e?.code === "PGRST205"
  );
  [
    ["day_reports", reportRes.error],
    ["upcoming_tasks", upRes.error],
    ["domains", domRes.error],
  ].forEach(([label, error]) => {
    if (error && error.code !== "PGRST205") fail(`Could not load ${label}`, error);
    else if (error) console.error(`Could not load ${label}:`, error);
  });
  if (missing) {
    notice("Tables missing — run final-setup.sql in the Supabase SQL editor.", "warning");
  }

  render();
}

async function commit(label, promise) {
  const { error } = await promise;
  if (error) {
    fail(label, error);
    await loadData();
    return false;
  }
  await loadData();
  return true;
}

// ===== Derived =====
// Every day worth offering in the day-picker: every day with a report,
// plus today (so there's always somewhere to upload a new one).
function allDays() {
  const set = new Set(Object.keys(state.reports));
  set.add(todayISO());
  return [...set].sort().reverse();
}

// ===== Rendering =====
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function render() {
  $("last-updated").textContent = state.meta.updated_at
    ? "Last updated: " + new Date(state.meta.updated_at).toLocaleString()
    : "Last updated: —";

  renderToday();
  renderReportList();
  renderDomains();
  renderUpcoming();

  document.querySelectorAll("[data-edit-only]").forEach((el) => el.classList.toggle("hidden", !isAdmin));
}

function renderToday() {
  renderDayPicker();
  renderReport();
}

// Populates the day dropdown with every day that has a report, plus
// today, newest first — and makes sure the currently selected day is
// always present as an option even if it's neither (e.g. after a jump).
function renderDayPicker() {
  const days = new Set(allDays());
  days.add(selectedDay);
  const sorted = [...days].sort().reverse();

  $("day-picker").innerHTML = sorted
    .map((day) => {
      const rel = relativeDay(day);
      const label = rel ? `${formatDay(day)} — ${rel}` : formatDay(day);
      return `<option value="${day}" ${day === selectedDay ? "selected" : ""}>${esc(label)}</option>`;
    })
    .join("");
}

function renderReport() {
  const report = state.reports[selectedDay];
  const viewer = $("pdf-viewer");
  const empty = $("pdf-empty");

  if (!report) {
    viewer.classList.add("hidden");
    $("pdf-frame").removeAttribute("src");
    empty.classList.remove("hidden");
    $("pdf-name").textContent = "";
    $("pdf-delete").classList.add("hidden");
    return;
  }

  // Storage public URLs are CDN-cached, and the path is stable per day
  // (`2026-08-23.pdf`). Without a cache-buster, re-uploading a day's report
  // would keep serving the previous file. uploaded_at changes on every
  // upsert, so it makes a good version key.
  const { data } = db.storage.from(BUCKET).getPublicUrl(report.pdf_path);
  const url = `${data.publicUrl}?v=${encodeURIComponent(report.uploaded_at || "")}`;
  $("pdf-frame").src = url;
  $("pdf-open").href = url;
  $("pdf-name").textContent = report.file_name || "report.pdf";
  viewer.classList.remove("hidden");
  empty.classList.add("hidden");
  $("pdf-delete").classList.toggle("hidden", !isAdmin);
}

function renderDomains() {
  $("domain-count").textContent =
    `${state.domains.length} domain${state.domains.length === 1 ? "" : "s"}`;
  $("domain-list").innerHTML = state.domains
    .map(
      (d) => `
    <li>
      <div class="domain-info">
        <strong>${esc(d.name)}</strong>
        ${d.note ? `<span class="domain-note">${esc(d.note)}</span>` : ""}
      </div>
      ${isAdmin ? `<span class="row-actions">
        <a href="#" data-edit-domain="${d.id}">Edit</a> |
        <a href="#" class="submitdelete" data-del-domain="${d.id}">Trash</a>
      </span>` : ""}
    </li>`
    )
    .join("");
  $("domain-empty").classList.toggle("hidden", state.domains.length > 0);
}

// All uploaded reports, newest day first — feeds the History table.
function renderReportList() {
  const days = Object.keys(state.reports).sort().reverse();
  $("report-count").textContent = `${days.length} report${days.length === 1 ? "" : "s"}`;
  $("report-list").innerHTML = days
    .map((day) => {
      const r = state.reports[day];
      const rel = relativeDay(day);
      return `
      <tr>
        <td class="title column-primary">
          <a href="#" class="row-title" data-goto-day="${day}">
            ${formatDay(day)} ${rel ? `<em class="history-rel-inline">${rel}</em>` : ""}
          </a>
        </td>
        <td class="notes">${esc(r.file_name || "report.pdf")}</td>
        <td class="col-uploaded">${r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : "—"}</td>
      </tr>`;
    })
    .join("");
  $("report-empty").classList.toggle("hidden", days.length > 0);
  $("report-table").classList.toggle("hidden", days.length === 0);
}

function renderUpcoming() {
  $("upcoming-list").innerHTML = state.upcoming
    .map(
      (t, i) => `
    <tr>
      <td class="col-order">${i + 1}</td>
      <td class="title column-primary">
        <strong><a href="#" class="row-title" data-edit-upcoming="${t.id}">${esc(t.title) || "(no title)"}</a></strong>
        ${isAdmin ? `<div class="row-actions">
          <span class="edit"><a href="#" data-edit-upcoming="${t.id}">Edit</a> | </span>
          <span class="trash"><a href="#" class="submitdelete" data-del-upcoming="${t.id}">Trash</a></span>
        </div>` : ""}
      </td>
      <td class="notes">${esc(t.notes)}</td>
    </tr>`
    )
    .join("");
  $("upcoming-empty").classList.toggle("hidden", state.upcoming.length > 0);
  $("upcoming-table").classList.toggle("hidden", state.upcoming.length === 0);
}

// ===== Auth =====
function setAdmin(on) {
  isAdmin = on;
  $("admin-badge").classList.toggle("hidden", !on);
  $("admin-btn").textContent = on ? "Log Out" : "Log In";
  render();
}

async function confirmAdmin() {
  const { data, error } = await db.rpc("is_admin");
  if (error) {
    console.warn("is_admin() unavailable:", error.message);
    return true; // RLS still blocks real writes
  }
  return data === true;
}

$("admin-btn").addEventListener("click", async () => {
  if (isAdmin) {
    const { error } = await db.auth.signOut();
    if (error) return fail("Sign out failed", error);
    notice("Signed out.");
    return;
  }
  $("login-modal").classList.remove("hidden");
  $("login-email").focus();
});

$("login-cancel").addEventListener("click", () => $("login-modal").classList.add("hidden"));
$("login-modal").addEventListener("click", (e) => {
  if (e.target === $("login-modal")) $("login-modal").classList.add("hidden");
});

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("login-error");
  err.classList.add("hidden");

  const { error } = await db.auth.signInWithPassword({
    email: $("login-email").value.trim(),
    password: $("login-password").value,
  });
  if (error) {
    err.textContent = error.message;
    err.classList.remove("hidden");
    return;
  }

  // Signing in != being an admin: this project allows public sign-up, and
  // RLS only grants writes to rows in public.admins.
  if (!(await confirmAdmin())) {
    await db.auth.signOut();
    err.textContent = "That account is not an admin on this dashboard.";
    err.classList.remove("hidden");
    return;
  }

  $("login-modal").classList.add("hidden");
  $("login-form").reset();
  notice("Logged in.");
});

db.auth.onAuthStateChange(async (_evt, session) => {
  setAdmin(session ? await confirmAdmin() : false);
});

// ===== Day navigation =====
function goToDay(day) {
  selectedDay = day;
  renderToday();
}

$("day-picker").addEventListener("change", (e) => e.target.value && goToDay(e.target.value));

// Admin-only: jump to ANY date, not just ones that already have a report,
// so a PDF can be uploaded (or an existing one replaced) for any day.
$("day-custom").addEventListener("change", (e) => {
  if (!e.target.value) return;
  goToDay(e.target.value);
  e.target.value = "";
});

// ===== PDF upload =====
$("pdf-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = $("pdf-file").files[0];
  if (!file) return notice("Choose a PDF first.", "warning");
  if (file.type !== "application/pdf") return notice("That file is not a PDF.", "error");
  if (file.size > 25 * 1024 * 1024) return notice("PDF is larger than 25 MB.", "error");

  const path = `${selectedDay}.pdf`;
  const up = await db.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (up.error) return fail("Upload failed", up.error);

  const ok = await commit(
    "Could not save report",
    db.from("day_reports").upsert(
      { day: selectedDay, pdf_path: path, file_name: file.name, uploaded_at: new Date().toISOString() },
      { onConflict: "day" }
    )
  );
  if (ok) {
    e.target.reset();
    notice("Report uploaded.");
  }
});

$("pdf-delete").addEventListener("click", async () => {
  const report = state.reports[selectedDay];
  if (!report || !confirm("Remove the report for this day?")) return;

  const rm = await db.storage.from(BUCKET).remove([report.pdf_path]);
  if (rm.error) return fail("Could not delete file", rm.error);

  if (await commit("Could not remove report", db.from("day_reports").delete().eq("day", selectedDay))) {
    notice("Report removed.");
  }
});

// ===== Domain writes =====
$("domain-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("domain-name").value.trim();
  if (!name) return;
  const ok = await commit(
    "Could not add domain",
    db.from("domains").insert({
      name,
      note: $("domain-note").value.trim(),
      sort_order: state.domains.length,
    })
  );
  if (ok) {
    e.target.reset();
    notice("Domain added.");
  }
});

// ===== Upcoming writes =====
$("upcoming-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("upcoming-title").value.trim();
  if (!title) return;
  const ok = await commit(
    "Could not add task",
    db.from("upcoming_tasks").insert({
      title,
      notes: $("upcoming-notes").value.trim(),
      sort_order: state.upcoming.length,
    })
  );
  if (ok) {
    e.target.reset();
    notice("Task added.");
  }
});

// ===== Row actions + history navigation =====
document.addEventListener("click", async (e) => {
  const jump = e.target.closest("[data-goto-day]");
  if (jump) {
    e.preventDefault();
    goToDay(jump.dataset.gotoDay);
    switchTab("today");
    return;
  }

  const link = e.target.closest(
    "a[data-edit-upcoming], a[data-del-upcoming], a[data-edit-domain], a[data-del-domain]"
  );
  if (!link) return;
  e.preventDefault();
  if (!isAdmin) return;

  const d = link.dataset;

  if (d.editUpcoming) {
    const t = state.upcoming.find((x) => x.id === d.editUpcoming);
    return openEditor("upcoming_tasks", t, [
      { key: "title", label: "Task", value: t.title },
      { key: "notes", label: "Notes", value: t.notes },
    ]);
  }
  if (d.editDomain) {
    const dom = state.domains.find((x) => x.id === d.editDomain);
    return openEditor("domains", dom, [
      { key: "name", label: "Domain", value: dom.name },
      { key: "note", label: "Note", value: dom.note },
    ]);
  }

  const table = d.delUpcoming ? "upcoming_tasks" : "domains";
  const id = d.delUpcoming || d.delDomain;
  if (!confirm("Move this item to the trash?")) return;
  if (await commit("Could not delete", db.from(table).delete().eq("id", id))) {
    notice("Item deleted.");
  }
});

// ===== Edit modal =====
function openEditor(table, row, fields) {
  if (!row) return;
  const form = $("edit-form");
  form.innerHTML =
    fields
      .map((f) => `<label>${esc(f.label)}<input name="${f.key}" value="${esc(f.value)}" /></label>`)
      .join("") +
    `<div class="modal-actions">
       <button type="button" class="button" id="edit-cancel">Cancel</button>
       <button type="submit" class="button button-primary">Update</button>
     </div>`;

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const patch = {};
    fields.forEach((f) => (patch[f.key] = form.elements[f.key].value.trim()));
    if (await commit("Could not update", db.from(table).update(patch).eq("id", row.id))) {
      $("edit-modal").classList.add("hidden");
      notice("Item updated.");
    }
  };
  form.querySelector("#edit-cancel").onclick = () => $("edit-modal").classList.add("hidden");

  $("edit-modal").classList.remove("hidden");
  form.querySelector("input")?.focus();
}

$("edit-modal").addEventListener("click", (e) => {
  if (e.target === $("edit-modal")) $("edit-modal").classList.add("hidden");
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  $("edit-modal").classList.add("hidden");
  $("login-modal").classList.add("hidden");
});

// ===== Tabs =====
const TAB_TITLES = { today: "Today", domains: "Current Domains", upcoming: "Upcoming" };

function switchTab(tab) {
  if (!TAB_TITLES[tab]) tab = "today";
  document.querySelectorAll(".menu-item").forEach((l) => {
    const on = l.dataset.tab === tab;
    l.classList.toggle("current", on);
    l.setAttribute("aria-current", on ? "page" : "false");
  });
  document.querySelectorAll("[data-panel]").forEach((s) => {
    s.classList.toggle("hidden", s.dataset.panel !== tab);
  });
  $("page-title").textContent = TAB_TITLES[tab];
  window.scrollTo({ top: 0 });
}

window.addEventListener("hashchange", () => switchTab(location.hash.slice(1)));

// ===== Init =====
switchTab(location.hash.slice(1) || "today");
loadData();
