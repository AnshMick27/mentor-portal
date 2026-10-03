"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
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

/** Initials of the first and last name for the round badge beside the name (decorative: the name is shown too). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((word) => word[0].toUpperCase()).join("") || "?";
}

/** White bar with a soft shadow (Stitch design, T40a): blue brand, initials badge and name, sign out, then the tabs. */
export function AppHeader({ profile }: { profile: UserProfile }) {
  const { signOut } = useAuth();
  const pathname = usePathname() ?? "";
  const items = navItemsFor(profile);
  return (
    <header className="bg-card shadow-card">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href={homeFor(profile)} className="truncate text-lg font-bold tracking-tight text-primary dark:text-link">
          CDC Mentor Portal
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden min-w-0 items-center gap-2 sm:flex">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
            >
              {initialsOf(profile.name)}
            </span>
            <span className="truncate text-sm font-medium">{profile.name}</span>
          </span>
          <Button variant="secondary" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
      {items.length > 0 && (
        <nav aria-label="Main">
          <ul className="mx-auto flex w-full max-w-5xl gap-4 px-4 sm:gap-6 sm:px-6">
            {items.map((item) => {
              const current = isCurrent(item.href, pathname, items);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center border-b-2 text-sm transition-colors ${
                      current
                        ? "border-primary font-semibold text-foreground dark:border-link"
                        : "border-transparent text-muted hover:text-foreground"
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
