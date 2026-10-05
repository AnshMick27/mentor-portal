import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";
import { PageHeader } from "@/components/ui/PageHeader";

/** Presentational "Waiting for approval" screen (T48); render-tested. Sign out stays in the header. */
export function PendingApproval({
  name,
  checking,
  checked,
  onCheck,
}: {
  name: string;
  checking: boolean;
  checked: boolean;
  onCheck: () => void;
}) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <PageHeader title="Waiting for approval" subtitle={`Thanks, ${name}. Your profile is complete.`} />
      <Note tone="warning" title="Your account is waiting for approval" live>
        <p>
          Your mentor needs to approve your account before you can see your tasks and home page. This is usually quick;
          you do not need to do anything else.
        </p>
        <p>If it takes more than a day, message your mentor with your name and roll number.</p>
      </Note>
      <div className="flex flex-col items-start gap-2">
        <Button variant="secondary" onClick={onCheck} busy={checking} busyLabel="Checking…">
          Check again
        </Button>
        <p role="status" className="text-sm text-muted">
          {checked && !checking ? "Not approved yet. Please check again later." : ""}
        </p>
      </div>
    </section>
  );
}
