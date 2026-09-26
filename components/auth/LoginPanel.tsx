"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { guardRedirect } from "@/lib/auth/guards";
import { useAuth } from "./AuthProvider";

export function LoginPanel({ allowedDomain }: { allowedDomain: string }) {
  const { view, message, signIn } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const target = guardRedirect("login", view);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  async function handleSignIn() {
    setBusy(true);
    try {
      await signIn(allowedDomain);
    } finally {
      setBusy(false);
    }
  }

  const waiting = busy || view.status === "loading" || target !== null;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="text-base leading-relaxed opacity-80">
        Use your college Google account (<span className="font-medium">@{allowedDomain}</span>).
      </p>
      {message && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {message}
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={waiting}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
      >
        {waiting ? "Please wait…" : "Sign in with Google"}
      </button>
    </main>
  );
}
