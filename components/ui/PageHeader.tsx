import type { ReactNode } from "react";
import { BackLink } from "./TextLink";

export const SITE_NAME = "CDC Mentor Portal";

/**
 * The top of every signed-in page (docs/UX_REVIEW.md §3.2): optional back link, the one h1, a muted subtitle, and
 * optional badge/actions. Also sets the browser-tab title ("My tasks · CDC Mentor Portal"); React 19 hoists
 * `<title>` into the document head, which is how client pages get their own title (Next docs, error.md).
 */
export function PageHeader({
  title,
  tabTitle,
  subtitle,
  back,
  badge,
  actions,
}: {
  title: string;
  /** Tab title when it should differ from the h1 (e.g. "Home" for "Hi, Asha"). */
  tabTitle?: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <title>{`${tabTitle ?? title} · ${SITE_NAME}`}</title>
      {back && <BackLink href={back.href}>{back.label}</BackLink>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight break-words">{title}</h1>
          {badge}
        </div>
        {actions && <div className="flex flex-wrap items-start gap-3">{actions}</div>}
      </div>
      {subtitle && <div className="text-sm text-muted break-words">{subtitle}</div>}
    </div>
  );
}
