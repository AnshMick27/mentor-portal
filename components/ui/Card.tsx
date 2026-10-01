import Link from "next/link";
import type { ReactNode } from "react";

type CardStyle = { padding?: "md" | "sm" | "none"; className?: string };

const PADDING = { md: "p-4", sm: "p-3", none: "" } as const;

/** The one card look (docs/UX_REVIEW.md §3.2). Use the class string on `<details>`, `<dl>`, `<fieldset>` and the like. */
export function cardClasses({ padding = "md", className }: CardStyle = {}): string {
  return ["rounded-lg border border-line", PADDING[padding], className].filter(Boolean).join(" ");
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
export function CardLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cardClasses({ className: ["flex flex-col gap-1 hover:bg-surface", className].filter(Boolean).join(" ") })}>
      {children}
    </Link>
  );
}
