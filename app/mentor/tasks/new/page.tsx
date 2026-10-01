"use client";

import { MentorOnly } from "@/components/tasks/MentorOnly";
import { TaskForm } from "@/components/tasks/TaskForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { emptyTaskForm } from "@/lib/tasks/taskForm";

export default function NewTaskPage() {
  return (
    <MentorOnly>
      <PageHeader title="New task" back={{ href: "/mentor/tasks", label: "Tasks" }} />
      <TaskForm mode="new" initial={emptyTaskForm()} />
    </MentorOnly>
  );
}
