import { useCallback, useEffect, useRef, useState } from "react";
import { runMigrations } from "@/db/db";
import { syncSnapshotReminderSchedule } from "@/notifications/snapshotReminder";
import { ensureDefaultWallets } from "@/repositories/walletsRepo";
import { getPreference } from "@/repositories/preferencesRepo";
import type { ThemeMode } from "@/ui/theme";

type AppBootstrap = {
  ready: boolean;
  error: string | null;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  retry: () => void;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore sconosciuto durante l'avvio.";
}

export function useAppBootstrap(): AppBootstrap {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const mountedRef = useRef(true);

  const bootstrap = useCallback(async () => {
    if (!mountedRef.current) return;
    setReady(false);
    setError(null);
    try {
      await runMigrations();
      await ensureDefaultWallets();
      const pref = await getPreference("theme");
      try {
        await syncSnapshotReminderSchedule();
      } catch (notificationError) {
        console.warn("Failed to sync snapshot reminders on bootstrap", notificationError);
      }
      if (mountedRef.current) {
        setThemeMode(pref?.value === "light" ? "light" : "dark");
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(toErrorMessage(err));
      }
    } finally {
      if (mountedRef.current) {
        setReady(true);
      }
    }
  }, []);

  useEffect(() => {
    bootstrap();
    return () => {
      mountedRef.current = false;
    };
  }, [bootstrap]);

  return { ready, error, themeMode, setThemeMode, retry: bootstrap };
}
