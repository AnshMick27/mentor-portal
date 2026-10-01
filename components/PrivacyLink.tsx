import Link from "next/link";

export const PRIVACY_PATH = "/privacy";

const LINK_CLASS =
  "font-medium text-blue-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:text-blue-300";

/** "How your data is used" link to the privacy page. */
export function PrivacyLink({ children = "How your data is used" }: { children?: string }) {
  return (
    <Link href={PRIVACY_PATH} className={LINK_CLASS}>
      {children}
    </Link>
  );
}

/** One line next to the resume and intro forms: their text goes to an AI service (SPEC.md §10). */
export function AiDataNote() {
  return (
    <p className="text-sm opacity-80">
      Your text is sent to an outside AI service only to get feedback, and is saved with your attempt. <PrivacyLink />
    </p>
  );
}
