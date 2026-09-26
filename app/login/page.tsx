import type { Metadata } from "next";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { getServerEnv } from "@/lib/config/env";

export const metadata: Metadata = { title: "Sign in · CDC Mentor Portal" };

export default function LoginPage() {
  // The domain is not secret; it only pre-filters Google's account chooser (`hd`). The server enforces it.
  return <LoginPanel allowedDomain={getServerEnv().ALLOWED_EMAIL_DOMAIN} />;
}
