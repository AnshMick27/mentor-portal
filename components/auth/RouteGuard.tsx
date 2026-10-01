"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { guardRedirect, type GuardArea } from "@/lib/auth/guards";
import { AppHeader } from "@/components/AppHeader";
import { useAuth, useSignedInProfile } from "./AuthProvider";

/**
 * Renders children only for users allowed in `area`; redirects everyone else (SPEC.md §8.1).
 * Navigation convenience only: Firestore rules and `requireUser` are what actually protect data.
 */
export function RouteGuard({ area, children }: { area: GuardArea; children: ReactNode }) {
  const { view } = useAuth();
  const router = useRouter();
  const target = guardRedirect(area, view);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (view.status !== "signedIn" || target) return <LoadingScreen />;
  return children;
}

/** Guarded page frame: skip link, header with navigation and sign-out, then the page in a mobile-first column. */
export function ProtectedShell({ area, children }: { area: GuardArea; children: ReactNode }) {
  return (
    <RouteGuard area={area}>
      <SkipLink />
      <SignedInHeader />
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </RouteGuard>
  );
}

/** First tab stop: lets keyboard users jump past the header links (hidden until focused). */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2"
    >
      Skip to content
    </a>
  );
}

function SignedInHeader() {
  return <AppHeader profile={useSignedInProfile()} />;
}

export function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12" role="status" aria-live="polite">
      <p className="text-base opacity-70">Loading…</p>
    </div>
  );
}
