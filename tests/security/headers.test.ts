import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security/headers";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d === name || d.startsWith(`${name} `))
    ?.split(" ")
    .slice(1);

describe("contentSecurityPolicy", () => {
  const prod = contentSecurityPolicy({ dev: false, authDomain: "mentor-portal-ansh.firebaseapp.com" });

  it("production: no eval, nobody may frame the portal, plugins off, http upgraded", () => {
    expect(directive(prod, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(prod, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(prod, "object-src")).toEqual(["'none'"]);
    expect(directive(prod, "base-uri")).toEqual(["'self'"]);
    expect(directive(prod, "form-action")).toEqual(["'self'"]);
    expect(prod.split("; ")).toContain("upgrade-insecure-requests");
    expect(prod).not.toContain("127.0.0.1");
    expect(prod).not.toContain("ws:");
  });

  it("allows exactly what Google sign-in and Firestore need (checked in a browser in T31)", () => {
    expect(directive(prod, "script-src")).toEqual(
      expect.arrayContaining(["'self'", "https://apis.google.com"]),
    );
    expect(directive(prod, "frame-src")).toEqual(
      expect.arrayContaining(["https://mentor-portal-ansh.firebaseapp.com", "https://accounts.google.com"]),
    );
    expect(directive(prod, "connect-src")).toEqual(
      expect.arrayContaining([
        "'self'",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://firestore.googleapis.com",
      ]),
    );
    expect(directive(prod, "worker-src")).toEqual(["'self'", "blob:"]); // pdf.js worker
    expect(directive(prod, "default-src")).toEqual(["'self'"]);
  });

  it("never allows a wildcard source on its own", () => {
    for (const d of prod.split("; ")) expect(d.split(" ").slice(1)).not.toContain("*");
  });

  it("development: eval for React's overlay, the local emulators, no upgrade", () => {
    const dev = contentSecurityPolicy({ dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toEqual(
      expect.arrayContaining(["http://127.0.0.1:9099", "http://127.0.0.1:8080", "ws:"]),
    );
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("adds the auth domain only when it is a plain host name", () => {
    for (const bad of ["https://evil.com", "*.example.com", "a.com/x", "evil.com 'unsafe-eval'", ""]) {
      const csp = contentSecurityPolicy({ dev: false, authDomain: bad });
      expect(csp).not.toContain("evil");
      expect(csp).not.toContain("example");
      expect(csp.match(/'unsafe-eval'/g)).toBeNull();
    }
  });
});

describe("securityHeaders and next.config.ts", () => {
  it("sends CSP, frame, sniffing, referrer and permissions headers on every route", async () => {
    const headers = Object.fromEntries(securityHeaders({ dev: false }).map((h) => [h.key, h.value]));
    expect(headers).toMatchObject({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Permissions-Policy"]).toContain("microphone=()");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    // No Cross-Origin-Opener-Policy: it would break the Google sign-in popup.
    expect(Object.keys(headers)).not.toContain("Cross-Origin-Opener-Policy");

    const routes = await nextConfig.headers?.();
    expect(routes).toHaveLength(1);
    expect(routes?.[0]?.source).toBe("/(.*)");
    expect(routes?.[0]?.headers.map((h) => h.key)).toEqual(Object.keys(headers));
  });
});
