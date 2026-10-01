import { TextLink } from "@/components/ui/TextLink";

export const PRIVACY_PATH = "/privacy";

/** "How your data is used" link to the privacy page. */
export function PrivacyLink({ children = "How your data is used" }: { children?: string }) {
  return (
    <TextLink href={PRIVACY_PATH} inline>
      {children}
    </TextLink>
  );
}

/** One line next to the resume and intro forms: their text goes to an AI service (SPEC.md §10). */
export function AiDataNote() {
  return (
    <p className="text-sm text-muted">
      Your text is sent to an outside AI service only to get feedback, and is saved with your attempt. <PrivacyLink />
    </p>
  );
}
