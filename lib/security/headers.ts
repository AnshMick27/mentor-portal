// Security headers for every response (T31). Imported by next.config.ts, so only RELATIVE imports here.
import { AUTH_EMULATOR_PORT, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT } from "../firebase/emulator.ts";

export type HeaderOptions = {
  /** `next dev` needs `'unsafe-eval'` (React error overlays) and the local emulators; production never. */
  dev: boolean;
  /** NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, e.g. `mentor-portal-ansh.firebaseapp.com` (the sign-in popup lives there). */
  authDomain?: string;
};

const GOOGLE_SIGN_IN = ["https://apis.google.com", "https://accounts.google.com"];
const FIREBASE_APIS = [
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://firestore.googleapis.com",
  "https://www.googleapis.com",
];

/** A bare host name only (no scheme, path or wildcard), so an odd env value can't widen the policy. */
function authDomainSource(authDomain: string | undefined): string[] {
  const host = authDomain?.trim().toLowerCase();
  return host && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? [`https://${host}`] : [];
}

/**
 * Content-Security-Policy without nonces (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
 * "Without Nonces"): pages stay static. Allows exactly what the app loads: its own files, Firebase Auth's Google
 * sign-in popup/iframe, Firebase Auth + Firestore APIs, the pdf.js worker (same origin or blob), and inline styles
 * (React style attributes, recharts). Nobody may frame the portal.
 */
export function contentSecurityPolicy({ dev, authDomain }: HeaderOptions): string {
  const emulators = dev
    ? [`http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, `http://${EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`]
    : [];
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), "https://apis.google.com", "https://www.gstatic.com"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", "https://*.googleusercontent.com"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", ...FIREBASE_APIS, ...GOOGLE_SIGN_IN, ...emulators, ...(dev ? ["ws:"] : [])]],
    ["frame-src", ["https://*.firebaseapp.com", ...authDomainSource(authDomain), ...GOOGLE_SIGN_IN, ...emulators]],
    ["worker-src", ["'self'", "blob:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  const policy = directives.map(([name, sources]) => `${name} ${[...new Set(sources)].join(" ")}`);
  // Locally the emulators are plain http; upgrading those requests would break them.
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Headers for every route (next.config.ts `headers()`). No COOP header: it would break the sign-in popup. */
export function securityHeaders(options: HeaderOptions): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ];
}
