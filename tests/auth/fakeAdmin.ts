import { vi } from "vitest";

/** Decoded ID-token fields our code reads. */
export type FakeToken = { uid: string; email?: string; email_verified?: boolean; name?: string };

type Data = Record<string, unknown>;
type DocRef = { kind: "doc"; collection: string; id: string; get: () => Promise<DocSnapshot> };
type DocSnapshot = { id: string; exists: boolean; data: () => Data | undefined };
type Query = {
  kind: "query";
  where: (field: string, op: "==", value: unknown) => Query;
  limit: (n: number) => Query;
  get: () => Promise<QuerySnapshot>;
};
type QuerySnapshot = { empty: boolean; size: number; docs: DocSnapshot[] };

/**
 * In-memory stand-in for the Admin SDK pieces we use: `verifyIdToken` (token string → decoded token) and
 * Firestore docs in any collection with get, equality queries, and transaction get/create/set/update.
 * Register with `vi.mock("@/lib/firebase/admin", async () => (await import("./fakeAdmin")).fakeAdmin.module)`.
 */
export function createFakeAdmin() {
  const tokens = new Map<string, FakeToken>();
  const store = new Map<string, Map<string, Data>>();

  function collectionData(name: string): Map<string, Data> {
    let docs = store.get(name);
    if (!docs) {
      docs = new Map();
      store.set(name, docs);
    }
    return docs;
  }

  function snapshot(collection: string, id: string): DocSnapshot {
    const data = collectionData(collection).get(id);
    return { id, exists: data !== undefined, data: () => data };
  }

  function docRef(collection: string, id: string): DocRef {
    return { kind: "doc", collection, id, get: async () => snapshot(collection, id) };
  }

  function query(collection: string, filters: [string, unknown][], max: number): Query {
    return {
      kind: "query",
      where: (field, _op, value) => query(collection, [...filters, [field, value]], max),
      limit: (n) => query(collection, filters, n),
      get: async () => {
        const docs = [...collectionData(collection)]
          .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
          .slice(0, max)
          .map(([id]) => snapshot(collection, id));
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    };
  }

  const db = {
    collection: (name: string) => ({
      doc: (id: string) => docRef(name, id),
      where: (field: string, op: "==", value: unknown) => query(name, [], Infinity).where(field, op, value),
    }),
    runTransaction: vi.fn(async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const tx = {
        get: (target: DocRef | Query) => target.get(),
        create: (ref: DocRef, data: Data) => {
          if (collectionData(ref.collection).has(ref.id)) throw new Error("already exists");
          collectionData(ref.collection).set(ref.id, data);
        },
        set: (ref: DocRef, data: Data) => {
          collectionData(ref.collection).set(ref.id, data);
        },
        update: (ref: DocRef, data: Data) => {
          const docs = collectionData(ref.collection);
          if (!docs.has(ref.id)) throw new Error("not found");
          docs.set(ref.id, { ...docs.get(ref.id), ...data });
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
    /** Docs of one collection (live map: tests may read, set and clear it). */
    collection: collectionData,
    users: collectionData("users"),
    /** Clears tokens and every collection. */
    reset: () => {
      tokens.clear();
      for (const docs of store.values()) docs.clear();
    },
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
