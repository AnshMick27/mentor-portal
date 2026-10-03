import { PrivacyLink } from "./PrivacyLink";

/** On every page (root layout): where to get help and how data is used. No email address in the code. */
export function SiteFooter() {
  return (
    <footer className="mt-8 bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-4 text-sm sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">Need help? Message your mentor.</p>
        <PrivacyLink className="inline-flex min-h-11 items-center self-start" />
      </div>
    </footer>
  );
}
