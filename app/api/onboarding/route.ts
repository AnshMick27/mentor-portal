import { jsonError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parseBody";
import { requireUser } from "@/lib/auth/requireUser";
import { completeOnboarding } from "@/lib/onboarding/completeOnboarding";
import { onboardingSchema } from "@/lib/validation/onboarding";

/** Student-only: saves roll number and branch once (SPEC.md §8.1). */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["student"]);
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, onboardingSchema);
  if (!body.ok) return body.response;

  try {
    const result = await completeOnboarding(auth.value.uid, body.data);
    if (!result.ok) return jsonError(result.status, result.message);
    return Response.json({ profile: result.profile });
  } catch (error) {
    console.error(`POST /api/onboarding failed for uid ${auth.value.uid}:`, error);
    return jsonError(500, "Could not save your details. Please try again.");
  }
}
