import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/Markdown";
import { TaskList, TaskListHeader } from "@/components/tasks/TaskList";
import type { TaskDto } from "@/lib/validation/task";

describe("Markdown", () => {
  it("renders basic markdown", () => {
    const html = renderToStaticMarkup(<Markdown>{"# Title\n\n**bold** and `code`\n\n- item"}</Markdown>);
    expect(html).toContain("<h3>Title</h3>"); // shifted under the page's "What to do" h2 (UX-11)
    expect(html).not.toContain("<h1");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<li>item</li>");
  });

  it("drops raw HTML such as script tags and event handlers", () => {
    const html = renderToStaticMarkup(
      <Markdown>{'Hello <script>alert(1)</script> <img src=x onerror="alert(2)"> <b>bold</b>'}</Markdown>,
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
  });

  it("removes javascript: links and hardens normal links", () => {
    const html = renderToStaticMarkup(<Markdown>{"[bad](javascript:alert(1)) [good](https://example.com)"}</Markdown>);
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
});

const task = (fields: Partial<TaskDto>): TaskDto => ({
  id: "t1",
  title: "Resume review",
  type: "resume",
  description: "d",
  dueAt: "2026-10-05T18:29:00.000Z",
  status: "draft",
  maxAttempts: 3,
  createdBy: "m1",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
  ...fields,
});

describe("TaskList", () => {
  const tasks = [task({}), task({ id: "t2", title: "Two sum", type: "coding", status: "published" })];

  it("shows title, status, type and IST due date for every task", () => {
    const html = renderToStaticMarkup(<TaskList tasks={tasks} canEdit />);
    expect(html).toContain("Resume review");
    expect(html).toContain("Draft");
    expect(html).toContain("Published");
    expect(html).toContain("Coding");
    expect(html).toContain("5 Oct 2026, 11:59 pm IST");
  });

  const page = (canEdit: boolean) =>
    renderToStaticMarkup(
      <>
        <TaskListHeader canEdit={canEdit} />
        <TaskList tasks={tasks} canEdit={canEdit} />
      </>,
    );

  it("gives mentors a New task button and edit links", () => {
    const html = page(true);
    expect(html).toContain('href="/mentor/tasks/new"');
    expect(html).toContain('href="/mentor/tasks/t2"');
  });

  it("shows viewers the list without any buttons or edit links", () => {
    const html = page(false);
    expect(html).toContain("Two sum");
    expect(html).not.toContain("/mentor/tasks/new");
    expect(html).not.toContain('href="/mentor/tasks/t');
    expect(html).not.toContain("<button");
  });

  it("says so when there are no tasks", () => {
    expect(renderToStaticMarkup(<TaskList tasks={[]} canEdit={false} />)).toContain("No tasks yet.");
  });
});
