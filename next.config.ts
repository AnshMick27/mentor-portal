import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security/headers.ts";

const nextConfig: NextConfig = {
  // Security headers on every route (T31; see lib/security/headers.ts).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders({
          dev: process.env.NODE_ENV === "development",
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        }),
      },
    ];
  },
};

export default nextConfig;
