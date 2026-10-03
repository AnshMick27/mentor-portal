import Link from "next/link";
import type { ReactNode } from "react";

type CardStyle = {
  padding?: "md" | "sm" | "none";
  /** The one card the screen wants you to open next: blue-tinted instead of the plain border. */
  primary?: boolean;
  className?: string;
};

const PADDING = { md: "p-4", sm: "p-3", none: "" } as const;

/** The one card look (docs/UX_REVIEW.md §3.2; Stitch design T40a: white on the tinted page, soft shadow, faint ring for dark mode). Use the class string on `<details>`, `<dl>`, `<fieldset>` and the like. */
export function cardClasses({ padding = "md", primary = false, className }: CardStyle = {}): string {
  const tone = primary
    ? "bg-blue-50 ring-blue-700/40 dark:bg-blue-950/60 dark:ring-blue-300/40"
    : "bg-card ring-line";
  return ["rounded-lg shadow-card ring-1", tone, PADDING[padding], className].filter(Boolean).join(" ");
}

export function Card({
  as: Tag = "div",
  padding,
  className,
  children,
}: CardStyle & { as?: "div" | "li" | "section"; children: ReactNode }) {
  return <Tag className={cardClasses({ padding, className })}>{children}</Tag>;
}

/** A whole card that is one link (task cards): a big tap target with a hover tint. */
export function CardLink({
  href,
  primary,
  className,
  children,
}: {
  href: string;
  primary?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const hover = ["transition-shadow hover:shadow-md", primary ? "hover:bg-blue-100 dark:hover:bg-blue-950/70" : "hover:bg-surface"].join(" ");
  return (
    <Link href={href} className={cardClasses({ primary, className: ["flex flex-col gap-1", hover, className].filter(Boolean).join(" ") })}>
      {children}
    </Link>
  );
}
