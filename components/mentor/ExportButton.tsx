"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchExport } from "@/lib/export/download";

/** Downloads the Excel export (mentor and viewer). Fetches with the ID token, then saves the file. */
export function ExportButton() {
  const { getIdToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function download() {
    setBusy(true);
    setError(undefined);
    const result = await fetchExport(getIdToken);
    if (result.ok) {
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } else {
      setError(result.message);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-lg border border-black/20 px-5 font-semibold hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/[0.06]"
      >
        {busy ? "Preparing Excel…" : "Export Excel"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
