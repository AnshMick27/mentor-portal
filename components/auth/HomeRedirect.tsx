"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { guardRedirect } from "@/lib/auth/guards";
import { useAuth } from "./AuthProvider";

/**
 * On the landing page: a signed-in user goes straight to their home (T41, UX-01). Signed-out visitors (and removed
 * users, who are signed out by `/api/me`) stay on the page. Renders nothing.
 */
export function HomeRedirect() {
  const { view } = useAuth();
  const router = useRouter();
  const target = guardRedirect("home", view);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  return null;
}
