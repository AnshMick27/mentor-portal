"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PrivacyLink } from "@/components/PrivacyLink";
import { Button } from "@/components/ui/Button";
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
      <Button onClick={() => void handleSignIn()} busy={waiting} busyLabel="Please wait…">
        Sign in with Google
      </Button>
      <p className="text-sm opacity-80">
        Signing in creates your portal profile. <PrivacyLink />
      </p>
    </main>
  );
}
