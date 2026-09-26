import { vi } from "vitest";

/** Decoded ID-token fields our code reads. */
export type FakeToken = { uid: string; email?: string; email_verified?: boolean; name?: string };

/**
 * In-memory stand-in for the Admin SDK pieces we use: `verifyIdToken` (token string → decoded token)
 * and `users/{uid}` docs with get/transaction create/update. Register with
 * `vi.mock("@/lib/firebase/admin", () => fakeAdmin.module)`.
 */
export function createFakeAdmin() {
  const tokens = new Map<string, FakeToken>();
  const users = new Map<string, Record<string, unknown>>();

  function docRef(collection: string, id: string) {
    if (collection !== "users") throw new Error(`fake admin: unexpected collection ${collection}`);
    return {
      id,
      get: async () => snapshot(id),
    };
  }

  function snapshot(id: string) {
    const data = users.get(id);
    return { exists: data !== undefined, data: () => data };
  }

  const db = {
    collection: (name: string) => ({ doc: (id: string) => docRef(name, id) }),
    runTransaction: vi.fn(async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const tx = {
        get: async (ref: { id: string }) => snapshot(ref.id),
        create: (ref: { id: string }, data: Record<string, unknown>) => {
          if (users.has(ref.id)) throw new Error("already exists");
          users.set(ref.id, data);
        },
        update: (ref: { id: string }, data: Record<string, unknown>) => {
          users.set(ref.id, { ...users.get(ref.id), ...data });
        },
      };
      return fn(tx);
    }),
  };

  const auth = {
    verifyIdToken: vi.fn(async (token: string) => {
      const decoded = tokens.get(token);
      if (!decoded) throw new Error("auth/argument-error");
      return decoded;
    }),
  };

  return {
    tokens,
    users,
    module: { getAdminAuth: () => auth, getAdminDb: () => db },
  };
}

/** A POST request carrying `Authorization: Bearer <token>` (or no header when token is undefined). */
export function requestWithToken(token: string | undefined, url = "http://localhost/api/test"): Request {
  const headers = token === undefined ? undefined : { authorization: `Bearer ${token}` };
  return new Request(url, { method: "POST", headers });
}

/** Shared instance so `vi.mock` factories and test bodies see the same fake. Clear its maps in `beforeEach`. */
export const fakeAdmin = createFakeAdmin();

/** Server env as the auth code sees it in tests. */
export const fakeEnv = {
  ALLOWED_EMAIL_DOMAIN: "college.ac.in",
  MENTOR_EMAILS: new Set(["ansh@college.ac.in"]),
  VIEWER_EMAILS: new Set(["boss@college.ac.in"]),
};
