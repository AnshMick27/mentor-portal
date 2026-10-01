import { ButtonLink } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">CDC Mentor Portal</h1>
      <p className="text-base leading-relaxed opacity-80">
        Placement preparation tasks, instant feedback and progress tracking for final-year students.
      </p>
      <ButtonLink href="/login">Sign in</ButtonLink>
    </main>
  );
}
