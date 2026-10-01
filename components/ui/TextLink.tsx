import Link from "next/link";
import type { ComponentProps } from "react";

type LinkStyle = {
  /** Inside a sentence: always underlined, so colour is never the only signal. Standalone links underline on hover. */
  inline?: boolean;
  /** Semibold, for names that head a card (e.g. a student in a list). */
  strong?: boolean;
  className?: string;
};

/** The one link look (docs/UX_REVIEW.md §3.2): link colour from the theme tokens, readable in both modes. */
export function textLinkClasses({ inline = false, strong = false, className }: LinkStyle = {}): string {
  return [
    "text-link underline-offset-2",
    strong ? "font-semibold" : "font-medium",
    inline ? "underline" : "hover:underline",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function TextLink({ inline, strong, className, ...rest }: LinkStyle & ComponentProps<typeof Link>) {
  return <Link className={textLinkClasses({ inline, strong, className })} {...rest} />;
}

/** "← Students": goes up one level. Name the place it leads to, not "Back". 44 px tall for thumbs. */
export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-link underline-offset-2 hover:underline"
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
