export interface DayReport {
  day: string;
  pdf_path: string;
  file_name: string;
  /** Set by every upsert in this app, but the column itself is nullable. */
  uploaded_at: string | null;
}

export interface Domain {
  id: string;
  name: string;
  note: string;
  sort_order: number;
  /** NOT NULL DEFAULT 0 (see add-impressions-column.sql). */
  impressions_last_week: number;
}

export interface UpcomingTask {
  id: string;
  title: string;
  notes: string;
  sort_order: number;
}
