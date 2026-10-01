import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeleteTaskControls } from "@/components/tasks/DeleteTask";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ getIdToken: async () => "t" }) }));

const noop = () => undefined;
const props = { title: "Sum two numbers", onStart: noop, onCancel: noop, onConfirm: noop };

describe("DeleteTaskControls (T37)", () => {
  it("starts with one Delete button and points to Draft for only hiding a task", () => {
    const html = renderToStaticMarkup(<DeleteTaskControls {...props} hasSubmissions={false} step="idle" />);
    expect(html).toContain(">Delete task</button>");
    expect(html).toContain("set it to Draft above instead");
    expect(html).not.toContain("Yes, delete");
  });

  it("confirms by name and says what happens to students' attempts", () => {
    const html = renderToStaticMarkup(<DeleteTaskControls {...props} hasSubmissions step="confirm" />);
    expect(html).toContain('aria-label="Delete Sum two numbers"');
    expect(html).toContain("stay in their history but stop counting");
    expect(html).toContain("This can&#x27;t be undone.");
    expect(html).toContain(">Yes, delete</button>");
    expect(html).toContain(">Cancel</button>");
  });

  it("says so when nobody has submitted, and shows server errors", () => {
    const html = renderToStaticMarkup(<DeleteTaskControls {...props} hasSubmissions={false} step="confirm" error="Could not delete the task." />);
    expect(html).toContain("Nobody has submitted to it yet.");
    expect(html).toContain('role="alert"');
  });
});
