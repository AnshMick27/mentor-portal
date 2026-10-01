"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Switch } from "@/components/leaderboard/LeaderboardParts";
import { cardClasses } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { apiFetch } from "@/lib/api/client";
import { configView, type ConfigView } from "@/lib/leaderboard/view";

const HINT = "Students who opted in see the top 10 by average (name and average only). Off by default.";

/** Mentor-only on/off switch for the student leaderboard (`config/app.leaderboardEnabled`). */
export function LeaderboardSetting() {
  const { getIdToken } = useAuth();
  const [view, setView] = useState<ConfigView>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void apiFetch(getIdToken, "/api/config").then((result) => {
      if (!cancelled) setView(configView(result));
    });
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  const toggle = useCallback(
    async (leaderboardEnabled: boolean) => {
      setSaving(true);
      setError(undefined);
      const next = configView(await apiFetch(getIdToken, "/api/config", { method: "PATCH", body: { leaderboardEnabled } }));
      if (next.status === "ready") setView(next);
      else if (next.status === "error") setError(next.message);
      setSaving(false);
    },
    [getIdToken],
  );

  return <LeaderboardSettingView view={view} saving={saving} error={error} onToggle={(on) => void toggle(on)} />;
}

/** Presentational part (render-tested). */
export function LeaderboardSettingView({
  view,
  saving,
  error,
  onToggle,
}: {
  view: ConfigView;
  saving: boolean;
  error?: string;
  onToggle: (on: boolean) => void;
}) {
  return (
    <Section title="Student leaderboard" className={cardClasses()}>
      {view.status === "error" ? (
        <EmptyState>{view.message}</EmptyState>
      ) : (
        <Switch
          id="leaderboard-enabled"
          label={view.status === "ready" && view.leaderboardEnabled ? "Leaderboard is on" : "Leaderboard is off"}
          hint={HINT}
          checked={view.status === "ready" && view.leaderboardEnabled}
          disabled={view.status === "loading" || saving}
          error={error}
          onChange={onToggle}
        />
      )}
    </Section>
  );
}
