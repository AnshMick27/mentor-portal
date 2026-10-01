"use client";

import { useState } from "react";
import { TextLink } from "@/components/ui/TextLink";
import { formatIst } from "@/lib/dates/ist";
import { searchStudents, splitStudents, type StudentRow } from "@/lib/students/list";
import { RemoveStudentButton } from "./RemoveStudentButton";

function Row({ row, canEdit, onChanged }: { row: StudentRow; canEdit: boolean; onChanged: () => void }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/15">
      <div className="flex min-w-0 flex-col gap-0.5 text-sm">
        <TextLink href={`/mentor/students/${row.uid}`} strong className="text-base break-words">
          {row.name}
        </TextLink>
        <span className="break-all opacity-75">{row.email}</span>
        <span className="opacity-75">
          {row.rollNo ?? "No roll number"} · {row.branch ?? "—"}
          {row.joinedAt && <> · Joined {formatIst(row.joinedAt.toISOString())}</>}
        </span>
        {!row.onboarded && <span className="font-medium text-amber-800 dark:text-amber-300">Onboarding not finished</span>}
      </div>
      {canEdit && (
        <div className="shrink-0 sm:max-w-xs">
          <RemoveStudentButton uid={row.uid} name={row.name} removed={row.removed} onChanged={onChanged} />
        </div>
      )}
    </li>
  );
}

function Group({
  title,
  rows,
  empty,
  canEdit,
  onChanged,
}: {
  title: string;
  rows: StudentRow[];
  empty: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="text-lg font-semibold">
        {title} <span className="text-sm font-normal opacity-60">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm opacity-70">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <Row key={row.uid} row={row} canEdit={canEdit} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Every student account, searchable; mentors can remove and restore, viewers only read (T34b). */
export function StudentList({ rows, canEdit, onChanged }: { rows: StudentRow[]; canEdit: boolean; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const { active, removed } = splitStudents(searchStudents(rows, search));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-sm opacity-75">
          Everyone who has signed in with a college email. {canEdit ? "Remove anyone who is not your mentee." : "Read-only view."}
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Search by name, email or roll number
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-h-11 rounded-lg border border-black/20 bg-transparent px-3 text-base font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/25"
        />
      </label>
      <Group
        title="Active"
        rows={active}
        empty={search ? "No active student matches." : "No students yet."}
        canEdit={canEdit}
        onChanged={onChanged}
      />
      <Group
        title="Removed"
        rows={removed}
        empty={search ? "No removed student matches." : "Nobody has been removed."}
        canEdit={canEdit}
        onChanged={onChanged}
      />
    </div>
  );
}
