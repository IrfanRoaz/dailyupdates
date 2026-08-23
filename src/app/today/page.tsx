"use client";

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Upload, RefreshCw, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Loading } from "@/components/Loading";
import { supabase, BUCKET } from "@/lib/supabase";
import { formatDay, relativeDay, todayISO } from "@/lib/dates";

export default function TodayPage() {
  const { reports, isAdmin, loading, commit, notify } = useApp();
  const db = supabase();
  const [selectedDay, setSelectedDay] = useState(todayISO());
  const fileRef = useRef<HTMLInputElement>(null);

  // Every day worth offering in the dropdown: every day with a report,
  // plus today (so there's always somewhere to upload a new one), plus
  // whatever's currently selected (e.g. picked via the admin date input).
  const days = useMemo(() => {
    const set = new Set(Object.keys(reports));
    set.add(todayISO());
    set.add(selectedDay);
    return [...set].sort().reverse();
  }, [reports, selectedDay]);

  const report = reports[selectedDay];
  const historyDays = useMemo(() => Object.keys(reports).sort().reverse(), [reports]);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture the form before any await — React may have moved on from
    // this event by the time the upload finishes.
    const form = e.currentTarget;
    const file = fileRef.current?.files?.[0];
    if (!file) return notify("Choose a PDF first.", "warning");
    if (file.type !== "application/pdf") return notify("That file is not a PDF.", "error");
    if (file.size > 25 * 1024 * 1024) return notify("PDF is larger than 25 MB.", "error");

    const path = `${selectedDay}.pdf`;
    const up = await db.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: "application/pdf",
    });
    if (up.error) return notify(`Upload failed: ${up.error.message}`, "error");

    const ok = await commit(
      "Could not save report",
      db.from("day_reports").upsert(
        { day: selectedDay, pdf_path: path, file_name: file.name, uploaded_at: new Date().toISOString() },
        { onConflict: "day" }
      )
    );
    if (ok) {
      form.reset();
      notify(report ? "Report replaced." : "Report uploaded.");
    }
  }

  async function handleRemove() {
    if (!report || !confirm("Remove the report for this day?")) return;
    // NOTE: storage and DB deletes are not atomic — the file is removed
    // first so a failed row delete at least leaves no orphaned blob
    // serving stale data; the row would still point at a dead path.
    const rm = await db.storage.from(BUCKET).remove([report.pdf_path]);
    if (rm.error) return notify(`Could not delete file: ${rm.error.message}`, "error");
    if (await commit("Could not remove report", db.from("day_reports").delete().eq("day", selectedDay))) {
      notify("Report removed.");
    }
  }

  function handleCustomDate(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    setSelectedDay(e.target.value);
    e.target.value = "";
  }

  // Storage public URLs are CDN-cached and the path is stable per day, so
  // without a cache-buster a replacement upload would keep serving the
  // old file. uploaded_at changes on every upsert, so it's a good key
  // (falls back to the day itself for rows that somehow lack a timestamp).
  const pdfUrl = report
    ? `${db.storage.from(BUCKET).getPublicUrl(report.pdf_path).data.publicUrl}?v=${encodeURIComponent(
        report.uploaded_at ?? report.day
      )}`
    : null;

  return (
    <>
      <div className="page-title-row">
        <h1 className="wp-heading-inline">Today</h1>
        <div className="day-nav">
          <select
            id="day-picker"
            aria-label="Select a day"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
          >
            {days.map((day) => {
              const rel = relativeDay(day);
              return (
                <option key={day} value={day}>
                  {rel ? `${formatDay(day)} — ${rel}` : formatDay(day)}
                </option>
              );
            })}
          </select>
          {isAdmin && (
            <input
              type="date"
              id="day-custom"
              name="custom-day"
              aria-label="Pick any date to upload or replace its report"
              onChange={handleCustomDate}
            />
          )}
        </div>
      </div>
      <hr className="wp-header-end" />

      {loading ? (
        <Loading label="Loading today&rsquo;s report…" />
      ) : (
      <>
      <div className="postbox">
        <div className="postbox-header">
          <h2 className="hndle">Today&rsquo;s Work</h2>
          {report && <span className="pdf-name">{report.file_name || "report.pdf"}</span>}
        </div>

        {isAdmin && (
          <form className="inside pdf-upload" onSubmit={handleUpload}>
            <input ref={fileRef} name="pdf-file" type="file" accept="application/pdf" />
            <button type="submit" className="button button-primary">
              {report ? <RefreshCw /> : <Upload />}
              {report ? "Replace PDF" : "Upload PDF"}
            </button>
            {report && (
              <button type="button" className="button" onClick={handleRemove}>
                <Trash2 />
                Remove
              </button>
            )}
          </form>
        )}

        {report && pdfUrl ? (
          <div className="pdf-viewer">
            <iframe src={pdfUrl} title="Day report (PDF)" />
            <p className="pdf-fallback">
              Can&rsquo;t see the document?{" "}
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                Open it in a new tab
              </a>
              .
            </p>
          </div>
        ) : (
          <p className="empty-state inside-pad">No report uploaded for this day.</p>
        )}
      </div>

      <div className="postbox reports-box">
        <div className="postbox-header">
          <h2 className="hndle">History</h2>
          <span className="progress-pill">
            {historyDays.length} report{historyDays.length === 1 ? "" : "s"}
          </span>
        </div>
        {historyDays.length ? (
          <div className="table-scroll">
          <table className="wp-list-table widefat striped">
            <thead>
              <tr>
                <th scope="col" className="manage-column column-primary">
                  Day
                </th>
                <th scope="col" className="manage-column">
                  File
                </th>
                <th scope="col" className="manage-column col-uploaded">
                  Uploaded
                </th>
              </tr>
            </thead>
            <tbody>
              {historyDays.map((day) => {
                const r = reports[day];
                const rel = relativeDay(day);
                return (
                  <tr key={day}>
                    <td className="title column-primary">
                      {/* Button, not href="#": this selects a day, it
                          doesn't navigate anywhere. */}
                      <button type="button" className="link-button row-title" onClick={() => setSelectedDay(day)}>
                        {formatDay(day)} {rel && <em className="history-rel-inline">{rel}</em>}
                      </button>
                    </td>
                    <td className="notes" data-label="File">{r.file_name || "report.pdf"}</td>
                    <td className="col-uploaded" data-label="Uploaded">
                      {r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="empty-state">No reports uploaded yet.</p>
        )}
      </div>
      </>
      )}
    </>
  );
}
