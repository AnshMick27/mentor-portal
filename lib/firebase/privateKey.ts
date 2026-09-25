/**
 * Normalises FIREBASE_ADMIN_PRIVATE_KEY into a PEM string with real newlines.
 * Handles the forms the key arrives in: literal "\n" sequences (Vercel, unquoted .env),
 * real newlines (double-quoted .env), Windows line endings, and stray surrounding quotes.
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (key.length >= 2 && (key.startsWith('"') || key.startsWith("'")) && key.endsWith(key[0])) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\r/g, "").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  return `${key}\n`;
}
