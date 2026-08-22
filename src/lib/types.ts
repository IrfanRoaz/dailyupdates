export interface DayReport {
  day: string;
  pdf_path: string;
  file_name: string;
  uploaded_at: string;
}

export interface Domain {
  id: string;
  name: string;
  note: string;
  sort_order: number;
}

export interface UpcomingTask {
  id: string;
  title: string;
  notes: string;
  sort_order: number;
}
