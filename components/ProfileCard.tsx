import type { UserProfile } from "@/lib/validation/user";

const ROLE_LABEL: Record<UserProfile["role"], string> = {
  student: "Student",
  mentor: "Mentor",
  viewer: "Viewer (read-only)",
};

/** Placeholder dashboard content until the real dashboards arrive (Loop 3). */
export function ProfileCard({ profile, title }: { profile: UserProfile; title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-base">
        Welcome, <span className="font-semibold">{profile.name}</span>
      </p>
      <p className="text-sm opacity-70">
        Role: <span data-testid="role">{ROLE_LABEL[profile.role]}</span>
      </p>
    </section>
  );
}
