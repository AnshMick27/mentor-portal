import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">CDC Mentor Portal</h1>
      <p className="text-base leading-relaxed opacity-80">
        Placement preparation tasks, instant feedback and progress tracking for final-year students.
      </p>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Sign in
      </Link>
    </main>
  );
}
