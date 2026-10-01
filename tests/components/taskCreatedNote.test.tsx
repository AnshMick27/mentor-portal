import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const params = vi.hoisted(() => ({ query: "created=1" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(params.query),
  useRouter: () => ({ push: () => undefined }),
}));
vi.mock("@/components/auth/AuthProvider", () => ({ useSignedInProfile: () => ({ uid: "m1", name: "Mentor", role: "mentor" }) }));
vi.mock("@/components/useApiQuery", () => ({
  useApiQuery: () => ({ state: { status: "ready", data: { tasks: [] } }, reload: () => undefined }),
}));

describe("Task created note (UX-21)", () => {
  it("confirms a new task on the list it lands on", async () => {
    const { default: MentorTasksPage } = await import("@/app/mentor/tasks/page");
    const html = renderToStaticMarkup(<MentorTasksPage />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Task created.");
  });

  it("stays away on a normal visit", async () => {
    params.query = "";
    const { default: MentorTasksPage } = await import("@/app/mentor/tasks/page");
    expect(renderToStaticMarkup(<MentorTasksPage />)).not.toContain("Task created.");
  });
});
