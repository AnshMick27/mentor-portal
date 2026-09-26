"use client";

import { MentorOnly } from "@/components/tasks/MentorOnly";
import { TaskForm } from "@/components/tasks/TaskForm";
import { emptyTaskForm } from "@/lib/tasks/taskForm";

export default function NewTaskPage() {
  return (
    <MentorOnly>
      <h1 className="text-2xl font-bold tracking-tight">New task</h1>
      <TaskForm mode="new" initial={emptyTaskForm()} />
    </MentorOnly>
  );
}
