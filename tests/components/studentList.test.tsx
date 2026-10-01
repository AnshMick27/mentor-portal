import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RemoveStudentControls } from "@/components/mentor/RemoveStudentButton";
import { StudentList, StudentListHeader } from "@/components/mentor/StudentList";
import type { StudentRow } from "@/lib/students/list";

vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ getIdToken: async () => "token" }) }));

const rows: StudentRow[] = [
  { uid: "s1", name: "Mentee Asha", email: "asha@college.ac.in", rollNo: "0827CS1", branch: "CSE", onboarded: true, removed: false, joinedAt: new Date("2026-09-25T04:00:00Z") },
  { uid: "s2", name: "Stray Signup", email: "stray@college.ac.in", onboarded: false, removed: false },
  { uid: "s3", name: "Outsider Ravi", email: "ravi@college.ac.in", rollNo: "0827IT3", branch: "IT", onboarded: true, removed: true },
];
const noop = () => undefined;

describe("StudentList", () => {
  it("shows active and removed students in separate groups with their details and profile links", () => {
    const html = renderToStaticMarkup(<StudentList rows={rows} canEdit onChanged={noop} />);
    expect(html).toContain("Active <span");
    expect(html).toContain("(2)");
    expect(html).toContain("Removed <span");
    expect(html).toContain("(1)");
    expect(html.indexOf("Outsider Ravi")).toBeGreaterThan(html.indexOf("Removed <span"));
    expect(html).toContain('href="/mentor/students/s1"');
    expect(html).toContain("0827CS1 · CSE · Joined 25 Sept 2026");
    expect(html).toContain("Onboarding not finished");
    expect(html).toContain('type="search"');
  });

  it("gives mentors Remove buttons for active students and Restore for removed ones", () => {
    const html = renderToStaticMarkup(<StudentList rows={rows} canEdit onChanged={noop} />);
    expect(html.match(/Remove from portal/g)).toHaveLength(2);
    expect(html.match(/Restore access/g)).toHaveLength(1);
  });

  it("is read-only for viewers", () => {
    const html = renderToStaticMarkup(
      <>
        <StudentListHeader canEdit={false} />
        <StudentList rows={rows} canEdit={false} onChanged={noop} />
      </>,
    );
    expect(html).toContain("Read-only view.");
    expect(html).not.toContain("Remove from portal");
    expect(html).not.toContain("Restore access");
    expect(html).not.toContain("<button");
  });

  it("has empty states", () => {
    const html = renderToStaticMarkup(<StudentList rows={[]} canEdit onChanged={noop} />);
    expect(html).toContain("No students yet.");
    expect(html).toContain("Nobody has been removed.");
  });
});

describe("RemoveStudentControls", () => {
  const props = { name: "Outsider Ravi", removed: false, onStart: noop, onCancel: noop, onConfirm: noop };

  it("asks for confirmation, naming the student and explaining what happens", () => {
    expect(renderToStaticMarkup(<RemoveStudentControls {...props} step="idle" />)).toContain("Remove from portal");
    const confirm = renderToStaticMarkup(<RemoveStudentControls {...props} step="confirm" />);
    expect(confirm).toContain('aria-label="Remove Outsider Ravi"');
    expect(confirm).toContain("Outsider Ravi</span> from the portal?");
    expect(confirm).toContain("Their work is kept, and you can restore them later.");
    expect(confirm).toContain("Yes, remove");
    expect(confirm).toContain("Cancel");
  });

  it("disables both buttons while working and shows a server error", () => {
    const html = renderToStaticMarkup(<RemoveStudentControls {...props} step="working" error="You do not have access to this." />);
    expect(html).toContain("Removing…");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain("You do not have access to this.");
  });

  it("offers Restore for a removed student", () => {
    expect(renderToStaticMarkup(<RemoveStudentControls {...props} removed step="idle" />)).toContain("Restore access");
    expect(renderToStaticMarkup(<RemoveStudentControls {...props} removed step="working" />)).toContain("Restoring…");
  });
});
