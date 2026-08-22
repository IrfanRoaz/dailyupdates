"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { DayReport, Domain, UpcomingTask } from "@/lib/types";
import type { AuthChangeEvent, PostgrestError, Session } from "@supabase/supabase-js";

export interface Notice {
  id: number;
  message: string;
  type: "success" | "error" | "warning";
}

interface AppState {
  updatedAt: string | null;
  reports: Record<string, DayReport>; // day -> report
  domains: Domain[];
  upcoming: UpcomingTask[];
  loading: boolean;
}

interface AppContextValue extends AppState {
  isAdmin: boolean;
  notices: Notice[];
  notify: (message: string, type?: Notice["type"]) => void;
  dismissNotice: (id: number) => void;
  reload: () => Promise<void>;
  // Runs a write, reports failure, and always reloads from the server
  // afterward — so the screen only ever shows what the DB really accepted.
  commit: (label: string, promise: Promise<{ error: PostgrestError | null }>) => Promise<boolean>;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

let noticeId = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const db = supabase();
  const [state, setState] = useState<AppState>({
    updatedAt: null,
    reports: {},
    domains: [],
    upcoming: [],
    loading: true,
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);

  const dismissNotice = useCallback((id: number) => {
    setNotices((cur) => cur.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: Notice["type"] = "success") => {
      const id = ++noticeId;
      setNotices((cur) => [...cur, { id, message, type }]);
      if (type === "success") setTimeout(() => dismissNotice(id), 4000);
    },
    [dismissNotice]
  );

  const reload = useCallback(async () => {
    const [metaRes, reportRes, domRes, upRes] = await Promise.all([
      db.from("dashboard_meta").select("updated_at").eq("id", 1).maybeSingle(),
      db.from("day_reports").select("*"),
      db.from("domains").select("*").order("sort_order"),
      db.from("upcoming_tasks").select("*").order("sort_order"),
    ]);

    const reports: Record<string, DayReport> = {};
    (reportRes.data ?? []).forEach((r: DayReport) => (reports[r.day] = r));

    setState({
      updatedAt: metaRes.data?.updated_at ?? null,
      reports,
      domains: domRes.data ?? [],
      upcoming: upRes.data ?? [],
      loading: false,
    });

    // PGRST205 = table doesn't exist yet; one warning covers all of them
    // (they're created together by final-setup.sql).
    const results = [
      ["dashboard_meta", metaRes.error],
      ["day_reports", reportRes.error],
      ["domains", domRes.error],
      ["upcoming_tasks", upRes.error],
    ] as const;
    if (results.some(([, error]) => error?.code === "PGRST205")) {
      notify("Tables missing — run final-setup.sql in the Supabase SQL editor.", "warning");
    } else {
      for (const [label, error] of results) {
        if (error) notify(`Could not load ${label}: ${error.message}`, "error");
      }
    }
  }, [db, notify]);

  const commit = useCallback(
    async (label: string, promise: Promise<{ error: PostgrestError | null }>) => {
      const { error } = await promise;
      if (error) notify(`${label}: ${error.message}`, "error");
      await reload();
      return !error;
    },
    [notify, reload]
  );

  const confirmAdmin = useCallback(async () => {
    const { data, error } = await db.rpc("is_admin");
    if (error) {
      // Fail open on the UI flag only: RLS (not this boolean) is what
      // actually blocks writes, so a broken RPC just means admin controls
      // may render and then error visibly instead of hiding the app.
      console.warn("is_admin() unavailable:", error.message);
      return true;
    }
    return data === true;
  }, [db]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) return error.message;

      // Signing in isn't the same as being an admin: this project allows
      // public sign-up, and RLS only grants writes to public.admins rows.
      if (!(await confirmAdmin())) {
        await db.auth.signOut();
        return "That account is not an admin on this dashboard.";
      }
      notify("Logged in.");
      return null;
    },
    [db, confirmAdmin, notify]
  );

  const logout = useCallback(async () => {
    const { error } = await db.auth.signOut();
    if (error) notify(`Sign out failed: ${error.message}`, "error");
    else notify("Signed out.");
  }, [db, notify]);

  useEffect(() => {
    // Initial fetch-on-mount, same as the old app's `loadData()` call at
    // the bottom of app.js — intentional, not derived-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    const { data: sub } = db.auth.onAuthStateChange(async (_evt: AuthChangeEvent, session: Session | null) => {
      setIsAdmin(session ? await confirmAdmin() : false);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        isAdmin,
        notices,
        notify,
        dismissNotice,
        reload,
        commit,
        login,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
