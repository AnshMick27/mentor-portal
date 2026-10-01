import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BackLink } from "@/components/ui/TextLink";

export const metadata: Metadata = {
  title: "How your data is used · CDC Mentor Portal",
  description: "What the CDC Mentor Portal stores, who can see it, and where your work is sent.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const LIST = "list-disc space-y-1 pl-5";

/** Public, static page (no sign-in needed), linked from the footer, the login page and the feedback forms. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 leading-relaxed">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">How your data is used</h1>
        <p className="opacity-80">
          The CDC Mentor Portal helps you prepare for placements. This page explains, in plain words, what it keeps
          about you, who can see it, and where your work goes.
        </p>
      </div>

      <Section title="What the portal stores">
        <ul className={LIST}>
          <li>Your name and college email (from your Google sign-in), your roll number and branch.</li>
          <li>
            What you submit for each task: your code, your resume text or your written introduction, and the
            feedback and score you got for each attempt.
          </li>
          <li>Numbers worked out from your attempts: tasks submitted and missed, and your average scores.</li>
        </ul>
        <p>It does not store your password (Google handles sign-in), your resume PDF file, or any photos or audio.</p>
      </Section>

      <Section title="Who can see it">
        <ul className={LIST}>
          <li>You can see your own tasks, attempts, feedback and progress.</li>
          <li>Your mentors can see everyone&apos;s attempts, scores and feedback, to guide you.</li>
          <li>CDC leadership can see the same, read-only, including a spreadsheet export of scores.</li>
          <li>Other students cannot see your work or your scores.</li>
        </ul>
      </Section>

      <Section title="Where your work is sent">
        <ul className={LIST}>
          <li>
            <span className="font-medium">Resume PDF:</span> the text is read on your own phone or computer. The PDF
            file itself is never uploaded.
          </li>
          <li>
            <span className="font-medium">Resume and introduction text:</span> sent to an outside AI service only to
            get feedback on it. Don&apos;t include anything you would not put on a resume, such as ID or bank numbers.
          </li>
          <li>
            <span className="font-medium">Code:</span> run in a separate, locked-down test runner with no internet
            access, only to check it against the task&apos;s tests.
          </li>
        </ul>
      </Section>

      <Section title="The leaderboard">
        <p>
          The leaderboard is off unless your mentor switches it on, and you appear on it only if you choose to. It
          shows just your name and average score. You can switch it off again on your home screen at any time.
        </p>
      </Section>

      <Section title="Questions or changes">
        <p>
          To correct something, or if you have a question about your data, message your mentor or contact the CDC
          office.
        </p>
      </Section>

      <BackLink href="/">Portal home</BackLink>
    </main>
  );
}
