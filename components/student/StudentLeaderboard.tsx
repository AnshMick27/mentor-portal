"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, useSignedInProfile } from "@/components/auth/AuthProvider";
import { LeaderboardTable, Switch } from "@/components/leaderboard/LeaderboardParts";
import { apiFetch } from "@/lib/api/client";
import { leaderboardView, type LeaderboardView } from "@/lib/leaderboard/view";
import { optInResponseSchema } from "@/lib/validation/config";

const HINT = "Only your name and average are shown, and only while your mentor has the leaderboard switched on.";

/** The leaderboard card (only while it is on) plus the student's own opt-in switch (always). */
export function StudentLeaderboard() {
  const { getIdToken, refreshProfile } = useAuth();
  const profile = useSignedInProfile();
  const [view, setView] = useState<LeaderboardView>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void apiFetch(getIdToken, "/api/leaderboard").then((result) => {
      if (!cancelled) setView(leaderboardView(result));
    });
    return () => {
      cancelled = true;
    };
  }, [getIdToken, version]);

  const toggle = useCallback(
    async (showOnLeaderboard: boolean) => {
      setSaving(true);
      setError(undefined);
      const result = await apiFetch(getIdToken, "/api/me/leaderboard", { method: "POST", body: { showOnLeaderboard } });
      if (!result.ok) setError(result.message);
      else if (!optInResponseSchema.safeParse(result.data).success) setError("Could not save your choice. Please try again.");
      else {
        await refreshProfile();
        setVersion((v) => v + 1);
      }
      setSaving(false);
    },
    [getIdToken, refreshProfile],
  );

  return (
    <LeaderboardSection
      view={view}
      optedIn={profile.showOnLeaderboard}
      saving={saving}
      error={error}
      onToggle={(checked) => void toggle(checked)}
    />
  );
}

/** Presentational part of the student leaderboard (render-tested). */
export function LeaderboardSection({
  view,
  optedIn,
  saving,
  error,
  onToggle,
}: {
  view: LeaderboardView;
  optedIn: boolean;
  saving: boolean;
  error?: string;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label="Leaderboard">
      <h2 className="text-lg font-semibold">Leaderboard</h2>
      {view.status === "ready" && (
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <LeaderboardTable entries={view.entries} />
        </div>
      )}
      {view.status === "off" && <p className="text-sm opacity-70">The leaderboard is switched off right now.</p>}
      {view.status === "error" && <p className="text-sm opacity-70">{view.message}</p>}
      <Switch
        id="leaderboard-opt-in"
        label="Show me on the leaderboard"
        hint={HINT}
        checked={optedIn}
        disabled={saving}
        error={error}
        onChange={onToggle}
      />
    </section>
  );
}
