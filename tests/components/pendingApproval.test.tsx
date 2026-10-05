import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { navItemsFor } from "@/components/AppHeader";
import { ApproveStudentControls } from "@/components/mentor/ApproveStudentButton";
import { PendingNote } from "@/components/mentor/MentorDashboard";
import { StudentList } from "@/components/mentor/StudentList";
import { PendingApproval } from "@/components/PendingApproval";
import { guardRedirect, homeFor, type AuthView } from "@/lib/auth/guards";
import { approvalResponseSchema, splitStudents, type StudentRow } from "@/lib/students/list";
import type { UserProfile } from "@/lib/validation/user";

vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ getIdToken: async () => "token" }) }));

const student: UserProfile = {
  uid: "u1",
  name: "Neha",
  email: "neha@college.ac.in",
  role: "student",
  onboarded: true,
  rollNo: "0827CS9",
  branch: "CSE",
  showOnLeaderboard: false,
};
const pending: UserProfile = { ...student, pendingApproval: true };
const signedIn = (profile: UserProfile): AuthView => ({ status: "signedIn", profile });

describe("guards for a student waiting for approval (T48)", () => {
  it("onboarding comes first, then the waiting page, then the student home once approved", () => {
    expect(homeFor({ ...pending, onboarded: false })).toBe("/onboarding");
    expect(homeFor(pending)).toBe("/pending");
    expect(homeFor(student)).toBe("/student");
    expect(homeFor({ ...student, pendingApproval: false })).toBe("/student");
  });

  it("keeps a waiting student out of the student pages and onboarding, and on /pending", () => {
    for (const area of ["student", "onboarding", "login", "home", "mentor"] as const) {
      expect(guardRedirect(area, signedIn(pending))).toBe("/pending");
    }
    expect(guardRedirect("pending", signedIn(pending))).toBeNull();
  });

  it("sends everyone else away from /pending", () => {
    expect(guardRedirect("pending", signedIn(student))).toBe("/student");
    expect(guardRedirect("pending", signedIn({ ...pending, onboarded: false }))).toBe("/onboarding");
    expect(guardRedirect("pending", signedIn({ ...student, role: "mentor" }))).toBe("/mentor");
    expect(guardRedirect("pending", { status: "signedOut" })).toBe("/login");
  });

  it("shows no student links in the header while waiting", () => {
    expect(navItemsFor(pending)).toEqual([]);
    expect(navItemsFor(student).map((item) => item.href)).toEqual(["/student", "/student/tasks"]);
  });
});

describe("waiting page", () => {
  it("says the account is waiting, what happens next, and offers Check again", () => {
    const html = renderToStaticMarkup(<PendingApproval name="Neha" checking={false} checked={false} onCheck={() => undefined} />);
    expect(html).toContain("Waiting for approval");
    expect(html).toContain("Your account is waiting for approval");
    expect(html).toContain("before you can see your tasks and home page");
    expect(html).toContain('role="status"'); // the note is announced
    expect(html).toContain("Check again");
    expect(html).not.toContain("Not approved yet");
  });

  it("says when a check found no approval yet", () => {
    const html = renderToStaticMarkup(<PendingApproval name="Neha" checking={false} checked onCheck={() => undefined} />);
    expect(html).toContain("Not approved yet. Please check again later.");
  });
});

const rows: StudentRow[] = [
  { uid: "s1", name: "Mentee Asha", email: "asha@college.ac.in", rollNo: "0827CS1", branch: "CSE", onboarded: true, removed: false },
  { uid: "s2", name: "New Neha", email: "neha@college.ac.in", rollNo: "0827CS9", branch: "CSE", onboarded: true, removed: false, pending: true },
  { uid: "s3", name: "New Raj", email: "raj@college.ac.in", onboarded: false, removed: false, pending: true },
  { uid: "s4", name: "Gone Gita", email: "gita@college.ac.in", onboarded: true, removed: true, pending: true },
];

describe("student list (mentor)", () => {
  it("splits waiting, active and removed; a removed student is only under removed", () => {
    const { pending: waiting, active, removed } = splitStudents(rows);
    expect(waiting.map((r) => r.uid)).toEqual(["s2", "s3"]);
    expect(active.map((r) => r.uid)).toEqual(["s1"]);
    expect(removed.map((r) => r.uid)).toEqual(["s4"]);
  });

  it("lists waiting students first, with Approve and Remove for mentors", () => {
    const html = renderToStaticMarkup(<StudentList rows={rows} canEdit onChanged={() => undefined} />);
    expect(html.indexOf("Waiting for approval <span")).toBeLessThan(html.indexOf("Active <span"));
    expect(html.match(/>Approve</g)).toHaveLength(2);
    expect(html).toContain('aria-label="Approve New Neha"');
    expect(html.match(/Waiting for approval<\/span>/g)).toHaveLength(2); // chip on each waiting row
    expect(html.indexOf("New Neha")).toBeLessThan(html.indexOf("Mentee Asha"));
  });

  it("is read-only for viewers, and hides the empty group from them", () => {
    const viewerHtml = renderToStaticMarkup(<StudentList rows={rows} canEdit={false} onChanged={() => undefined} />);
    expect(viewerHtml).toContain("Waiting for approval <span");
    expect(viewerHtml).not.toContain(">Approve<");
    const none = renderToStaticMarkup(<StudentList rows={[rows[0]!]} canEdit={false} onChanged={() => undefined} />);
    expect(none).not.toContain("Waiting for approval");
    const mentorNone = renderToStaticMarkup(<StudentList rows={[rows[0]!]} canEdit onChanged={() => undefined} />);
    expect(mentorNone).toContain("Nobody is waiting.");
  });

  it("shows the Approve error line", () => {
    const html = renderToStaticMarkup(<ApproveStudentControls name="New Neha" working={false} error="Could not approve." onApprove={() => undefined} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Could not approve.");
  });

  it("accepts only the approve reply shape", () => {
    expect(approvalResponseSchema.safeParse({ student: { uid: "s2", pendingApproval: false } }).success).toBe(true);
    expect(approvalResponseSchema.safeParse({ student: { uid: "s2", removed: false } }).success).toBe(false);
  });
});

describe("mentor dashboard note", () => {
  it("counts waiting students and links to the Students page", () => {
    const html = renderToStaticMarkup(<PendingNote count={3} />);
    expect(html).toContain("3 new students are waiting for approval");
    expect(html).toContain('href="/mentor/students"');
    expect(renderToStaticMarkup(<PendingNote count={1} />)).toContain("1 new student is waiting for approval");
  });

  it("shows nothing when nobody is waiting", () => {
    expect(renderToStaticMarkup(<PendingNote count={0} />)).toBe("");
  });
});
