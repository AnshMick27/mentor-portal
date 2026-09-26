// `npm run seed`: writes demo data into the LOCAL emulators only. See README "Run against the emulators".
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { buildSeedData, emulatorHosts } from "./seedData.mts";

async function main(): Promise<void> {
  // Throws unless both hosts are local; setting them BEFORE initializeApp routes every Admin call to the emulators.
  const hosts = emulatorHosts(process.env);
  process.env.FIRESTORE_EMULATOR_HOST = hosts.firestore;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = hosts.auth;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const domain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
  if (!projectId || !domain) {
    throw new Error("Set FIREBASE_ADMIN_PROJECT_ID and ALLOWED_EMAIL_DOMAIN in .env.local first (see .env.example).");
  }

  try {
    await fetch(`http://${hosts.firestore}/`);
  } catch {
    throw new Error(`No Firestore emulator at ${hosts.firestore}. Start it first with: npm run emulators`);
  }

  // No credentials on purpose: with the emulator hosts set, nothing can reach the real project. Also skip the
  // Google Cloud metadata-server probe (it only produces a timeout warning on a laptop).
  process.env.METADATA_SERVER_DETECTION = "none";
  const app = initializeApp({ projectId }, "seed");
  const auth = getAuth(app);
  const db = getFirestore(app);
  const data = buildSeedData(domain, new Date());

  // Auth: recreate each demo user with a linked Google identity, so the emulator's sign-in popup lists them.
  await auth.deleteUsers(data.users.map((u) => u.uid));
  const imported = await auth.importUsers(
    data.users.map(({ uid, doc }) => ({
      uid,
      email: doc.email,
      emailVerified: true,
      displayName: doc.name,
      providerData: [{ uid: `google-${uid}`, providerId: "google.com", email: doc.email, displayName: doc.name }],
    })),
  );
  if (imported.failureCount > 0) {
    throw new Error(`Auth import failed: ${imported.errors.map((e) => e.error.message).join("; ")}`);
  }

  const now = Timestamp.now();
  const batch = db.batch();
  for (const { uid, doc } of data.users) batch.set(db.doc(`users/${uid}`), { ...doc, createdAt: now });
  for (const { uid, doc } of data.studentStats) batch.set(db.doc(`studentStats/${uid}`), { ...doc, updatedAt: now });
  for (const { id, task } of data.tasks) {
    const { coding, dueAt, ...rest } = task;
    batch.set(db.doc(`tasks/${id}`), {
      ...rest,
      ...(coding ? { coding } : {}),
      dueAt: Timestamp.fromDate(new Date(dueAt)),
      createdBy: "seed-mentor",
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  await deleteApp(app);

  console.log(`Seeded project "${projectId}" in the emulators (Firestore ${hosts.firestore}, Auth ${hosts.auth}):`);
  for (const { doc } of data.users) console.log(`  ${doc.role.padEnd(7)} ${doc.email}`);
  for (const { id, task } of data.tasks) console.log(`  task    ${id} (${task.status}, due ${task.dueAt})`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
