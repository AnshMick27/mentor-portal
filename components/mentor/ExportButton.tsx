"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
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
      <Button variant="secondary" className="self-start" onClick={() => void download()} busy={busy} busyLabel="Preparing Excel…">
        Export Excel
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
