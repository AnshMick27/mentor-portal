import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RemoveStudentControls } from "@/components/mentor/RemoveStudentButton";
import { TaskList } from "@/components/tasks/TaskList";
import type { TaskDto } from "@/lib/validation/task";

const hooks = vi.hoisted(() => ({
  refresh: () => undefined,
  reload: () => undefined,
  onChanged: undefined as (() => void) | undefined,
}));

vi.mock("@/components/auth/AuthProvider", () => ({
  useSignedInProfile: () => ({ uid: "m1", name: "Mentor", role: "mentor" }),
  useAuth: () => ({ getIdToken: async () => "t" }),
}));
vi.mock("@/components/useAsyncData", () => ({
  useAsyncData: () => ({
    state: { status: "ready", data: [] },
    reload: hooks.reload,
    refresh: hooks.refresh,
    refreshing: true,
  }),
}));
vi.mock("@/components/mentor/StudentList", () => ({
  StudentListHeader: () => <h1>Students</h1>,
  StudentList: ({ onChanged }: { onChanged: () => void }) => {
    hooks.onChanged = onChanged;
    return <ul id="student-list" />;
  },
}));

describe("Students page refresh (UX-12)", () => {
  it("keeps the list mounted while it refreshes after Remove/Restore, so the search box keeps its text", async () => {
    const { default: StudentsPage } = await import("@/app/mentor/students/page");
    const html = renderToStaticMarkup(<StudentsPage />);
    expect(html).toContain('<ul id="student-list">');
    expect(html).toContain("Updating…");
    expect(html).not.toContain("Loading the students");
    expect(hooks.onChanged).toBe(hooks.refresh);
  });
});

describe("Remove is never a full-width button (UX-14)", () => {
  it("lines the button up at the start instead of stretching it", () => {
    const props = { name: "Ravi", step: "idle" as const, onStart: () => undefined, onCancel: () => undefined, onConfirm: () => undefined };
    expect(renderToStaticMarkup(<RemoveStudentControls {...props} removed={false} />)).toMatch(/^<div class="flex flex-col items-start gap-1">/);
    expect(renderToStaticMarkup(<RemoveStudentControls {...props} removed />)).toMatch(/^<div class="flex flex-col items-start gap-1">/);
  });
});

describe("mentor task cards are one big link (UX-13)", () => {
  const task = {
    id: "t9",
    title: "Resume review",
    type: "resume",
    description: "",
    dueAt: "2026-10-05T18:29:00.000Z",
    status: "published",
    maxAttempts: 3,
    createdBy: "m1",
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  } as TaskDto;

  it("wraps title, badge and due date in one edit link for mentors, plus a separate submissions link", () => {
    const mentor = renderToStaticMarkup(<TaskList tasks={[task]} canEdit />);
    expect(mentor.match(/<a /g)).toHaveLength(2);
    expect(mentor).toMatch(/<a [^>]*href="\/mentor\/tasks\/t9"[^>]*>.*Resume review.*Due 5 Oct.*Published/);
    expect(mentor).toContain('href="/mentor/tasks/t9/submissions"');
  });

  it("gives viewers one link per published card, to its submissions, and none on drafts", () => {
    const viewer = renderToStaticMarkup(<TaskList tasks={[task]} canEdit={false} />);
    expect(viewer.match(/<a /g)).toHaveLength(1);
    expect(viewer).toMatch(/<a [^>]*href="\/mentor\/tasks\/t9\/submissions"[^>]*>.*Resume review/);
    const draft = renderToStaticMarkup(<TaskList tasks={[{ ...task, status: "draft" }]} canEdit={false} />);
    expect(draft).not.toContain("<a ");
  });
});
