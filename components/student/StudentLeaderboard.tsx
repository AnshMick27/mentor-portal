"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, useSignedInProfile } from "@/components/auth/AuthProvider";
import { LeaderboardTable, Switch } from "@/components/leaderboard/LeaderboardParts";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
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
    <Section title="Leaderboard">
      {view.status === "ready" && (
        <Card>
          <LeaderboardTable entries={view.entries} />
        </Card>
      )}
      {view.status === "off" && <EmptyState>The leaderboard is switched off right now.</EmptyState>}
      {view.status === "error" && <EmptyState>{view.message}</EmptyState>}
      <Switch
        id="leaderboard-opt-in"
        label="Show me on the leaderboard"
        hint={HINT}
        checked={optedIn}
        disabled={saving}
        error={error}
        onChange={onToggle}
      />
    </Section>
  );
}
