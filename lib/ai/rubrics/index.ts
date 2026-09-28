import { z } from "zod";
import type { AiTaskType } from "@/lib/validation/submission";
import introWritten from "./intro_written.json";
import resume from "./resume.json";

/**
 * Rubrics are plain JSON (SPEC.md §10) so they can be edited without touching code. They are validated
 * here: every criterion needs a name, a positive weight and guidance, and the weights must add up to 100.
 */
export const rubricSchema = z
  .object({
    title: z.string().min(1),
    criteria: z
      .array(
        z.object({
          name: z.string().min(1),
          weight: z.number().positive(),
          guidance: z.string().min(1),
        }),
      )
      .min(1),
  })
  .refine((rubric) => rubric.criteria.reduce((sum, c) => sum + c.weight, 0) === 100, "Weights must add up to 100.");
export type Rubric = z.infer<typeof rubricSchema>;

const RUBRICS: Record<AiTaskType, Rubric> = {
  resume: rubricSchema.parse(resume),
  intro_written: rubricSchema.parse(introWritten),
};

export function getRubric(type: AiTaskType): Rubric {
  return RUBRICS[type];
}
