import { createBrowserClient } from "@supabase/ssr";

// Same project the static version used — RLS (not this key) is what
// keeps writes admin-only, so the anon key is safe to ship client-side.
const SUPABASE_URL = "https://qlhqrluogpdpqloaqoqa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsaHFybHVvZ3BkcHFsb2Fxb3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MjA1NzYsImV4cCI6MjEwMjk5NjU3Nn0.x9bxZSuKxBmnXsxGNtUGxY2I1J6-MWrPAMr1KG_hnMc";

export const BUCKET = "reports";

let client: ReturnType<typeof createBrowserClient> | undefined;

// One client per browser session, created lazily so it never runs during
// server-side rendering.
export function supabase() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
