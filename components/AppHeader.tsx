"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { homeFor } from "@/lib/auth/guards";
import type { UserProfile } from "@/lib/validation/user";
import { useAuth } from "./auth/AuthProvider";

type NavItem = { href: string; label: string };

const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "Home" },
  { href: "/student/tasks", label: "My tasks" },
];
const STAFF_NAV: NavItem[] = [
  { href: "/mentor", label: "Dashboard" },
  { href: "/mentor/tasks", label: "Tasks" },
  { href: "/mentor/students", label: "Students" },
];

/** Main links for this user; none for a student who has not finished onboarding (those pages would redirect). */
export function navItemsFor(profile: UserProfile): NavItem[] {
  if (profile.role !== "student") return STAFF_NAV;
  return profile.onboarded ? STUDENT_NAV : [];
}

/** A home link (`/student`, `/mentor`) is current only on itself; section links also cover their sub-pages. */
export function isCurrent(href: string, pathname: string, items: NavItem[]): boolean {
  if (pathname === href) return true;
  const isHome = items[0]?.href === href;
  return !isHome && pathname.startsWith(`${href}/`);
}

export function AppHeader({ profile }: { profile: UserProfile }) {
  const { signOut } = useAuth();
  const pathname = usePathname() ?? "";
  const items = navItemsFor(profile);
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href={homeFor(profile)} className="truncate font-semibold">
          CDC Mentor Portal
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-sm text-muted sm:inline">{profile.name}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-11 shrink-0 rounded-lg border border-line-strong px-4 text-sm font-medium hover:bg-surface"
          >
            Sign out
          </button>
        </div>
      </div>
      {items.length > 0 && (
        <nav aria-label="Main" className="border-t border-line">
          <ul className="mx-auto flex w-full max-w-3xl gap-1 px-2">
            {items.map((item) => {
              const current = isCurrent(item.href, pathname, items);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-surface ${
                      current
                        ? "font-semibold text-foreground underline decoration-2 underline-offset-8"
                        : "text-muted"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
