import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { fieldErrorsFrom, OnboardingFields } from "@/components/OnboardingForm";
import { Field, inputClasses } from "@/components/ui/Field";
import { onboardingSchema } from "@/lib/validation/onboarding";

vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ getIdToken: async () => "t", refreshProfile: async () => undefined }) }));

const render = (props: { hint?: string; error?: string }) =>
  renderToStaticMarkup(
    <Field label="Roll number" {...props}>
      {(control) => <input {...control} className={inputClasses} />}
    </Field>,
  );

describe("Field", () => {
  it("labels the control by id", () => {
    const html = render({});
    const id = /<input id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<label for="${id}" class="font-medium">Roll number</label>`);
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("aria-invalid");
  });

  it("links the hint, and the error with aria-invalid", () => {
    const html = render({ hint: "Your college roll number.", error: "Enter your roll number." });
    const id = /<input id="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(html).toContain(`aria-describedby="${id}-hint ${id}-error"`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(`<p id="${id}-error" class="text-sm font-medium text-red-700 dark:text-red-300">Enter your roll number.</p>`);
  });

  it("uses a field border with at least 3:1 contrast", () => {
    expect(inputClasses).toContain("border-line-strong");
    expect(inputClasses).toContain("min-h-11");
  });
});

describe("onboarding errors sit under their field (UX-28)", () => {
  const props = {
    rollNo: "",
    branch: "",
    error: null,
    saving: false,
    onRollNo: () => undefined,
    onBranch: () => undefined,
    onSubmit: () => undefined,
  };

  it("maps each zod issue to its field", () => {
    const parsed = onboardingSchema.safeParse({ rollNo: "", branch: "" });
    expect(parsed.success).toBe(false);
    const errors = fieldErrorsFrom(parsed.success ? [] : parsed.error.issues);
    expect(errors.rollNo).toBeTruthy();
    expect(errors.branch).toBeTruthy();
  });

  it("marks only the invalid field and keeps server errors as one alert", () => {
    const html = renderToStaticMarkup(<OnboardingFields {...props} fieldErrors={{ branch: "Choose your branch." }} />);
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(1);
    expect(html).toMatch(/<select[^>]*aria-invalid="true"/);
    expect(html).toContain("Your college roll number.");
    expect(html).not.toContain('role="alert"');
    const server = renderToStaticMarkup(<OnboardingFields {...props} fieldErrors={{}} error="This roll number is already used." />);
    expect(server).toContain('role="alert"');
  });
});

describe("contrast guards (T35i)", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
    });

  it("no faint field borders and no opacity-dimmed text in components or pages", () => {
    for (const file of [...files(join(process.cwd(), "components")), ...files(join(process.cwd(), "app"))]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/border-black\/20|border-white\/25/);
      expect(source, file).not.toMatch(/(?<![\w:/-])opacity-(60|70|75|80)(?![\w/-])/);
    }
  });
});
