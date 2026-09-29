import "server-only";
import { getServerEnv } from "@/lib/config/env";
import type { Language } from "@/lib/validation/task";
import { SUBMISSION_ID_PATTERN } from "./callbackPayload";

export type JudgeDispatchInput = { submissionId: string; problemSlug: string; language: Language; code: string };

type DispatchConfig = { repo?: string; token?: string; fetch?: typeof fetch };

export class JudgeDispatchError extends Error {
  constructor(
    /** config: env missing (fix the deployment); github: the API refused or was unreachable (try again). */
    readonly kind: "config" | "github",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "JudgeDispatchError";
  }
}

/** The `client_payload` the judge workflow reads (judge-repo/README.md). */
export function judgeClientPayload({ submissionId, problemSlug, language, code }: JudgeDispatchInput) {
  return { submissionId, problemSlug, language, codeB64: Buffer.from(code, "utf8").toString("base64") };
}

/**
 * Starts the judge: a `repository_dispatch` (event type `judge`) on GITHUB_JUDGE_REPO, authorised by the
 * fine-grained GITHUB_JUDGE_TOKEN (SPEC.md §9). Resolves once GitHub accepts it (204); throws JudgeDispatchError.
 * The token never appears in errors or logs.
 */
export async function dispatchJudge(input: JudgeDispatchInput, config: DispatchConfig = {}): Promise<void> {
  const env = config.repo && config.token ? undefined : getServerEnv();
  const repo = config.repo ?? env?.GITHUB_JUDGE_REPO;
  const token = config.token ?? env?.GITHUB_JUDGE_TOKEN;
  const missing = [!repo && "GITHUB_JUDGE_REPO", !token && "GITHUB_JUDGE_TOKEN"].filter(Boolean);
  if (!repo || !token) throw new JudgeDispatchError("config", `Judge is not configured: missing ${missing.join(", ")}.`);
  if (!SUBMISSION_ID_PATTERN.test(input.submissionId)) {
    throw new JudgeDispatchError("config", "Submission id is not valid for the judge.");
  }

  const fetchFn = config.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "cdc-mentor-portal",
      },
      body: JSON.stringify({ event_type: "judge", client_payload: judgeClientPayload(input) }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new JudgeDispatchError("github", "Could not reach GitHub to start the judge.", { cause: error });
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new JudgeDispatchError("github", `GitHub refused the judge dispatch (HTTP ${response.status}): ${detail}`);
  }
}
