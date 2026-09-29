import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Static checks of the judge template's security properties (SPEC.md §7.5–7.7, §9). */
const root = join(process.cwd(), "judge-repo");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const workflow = read(".github/workflows/judge.yml");
const runSh = read("scripts/run.sh");

const runJobStart = workflow.indexOf("\n  run:\n");
const reportJobStart = workflow.indexOf("\n  report:\n");
const runJob = workflow.slice(runJobStart, reportJobStart);
const reportJob = workflow.slice(reportJobStart);

/** The bodies of every `run: |` script block in the workflow. */
function scriptBlocks(yaml: string): string[] {
  const lines = yaml.split("\n");
  const blocks: string[] = [];
  lines.forEach((line, index) => {
    const match = /^(\s*)(?:- )?run: \|/.exec(line);
    if (!match) return;
    const indent = (match[1] ?? "").length;
    const body: string[] = [];
    for (const next of lines.slice(index + 1)) {
      if (next.trim() !== "" && next.length - next.trimStart().length <= indent) break;
      body.push(next);
    }
    blocks.push(body.join("\n"));
  });
  return blocks;
}

/** Every `docker run ...` command in run.sh, with line continuations joined. */
const dockerRuns = runSh
  .replace(/\\\n\s*/g, " ")
  .split("\n")
  .filter((line) => line.includes("docker run"));

describe("judge.yml", () => {
  it("is triggered only by repository_dispatch of type judge, with no default token permissions", () => {
    expect(workflow).toMatch(/on:\n\s+repository_dispatch:\n\s+types: \[judge\]/);
    expect(workflow).not.toMatch(/\n\s+(push|pull_request|pull_request_target|workflow_dispatch):/);
    expect(workflow).toMatch(/\npermissions: \{\}\n/);
  });

  it("has a run job and a report job that needs it", () => {
    expect(runJobStart).toBeGreaterThan(0);
    expect(reportJobStart).toBeGreaterThan(runJobStart);
    expect(reportJob).toMatch(/needs: run\b/);
  });

  it("run job: read-only contents, no kept git credentials, NO secrets, runs the harness", () => {
    expect(runJob).toMatch(/permissions:\n\s+contents: read\n/);
    expect(runJob).toContain("persist-credentials: false");
    expect(runJob).not.toContain("secrets.");
    expect(runJob).not.toMatch(/JUDGE_WEBHOOK_SECRET|GITHUB_TOKEN|github\.token/);
    expect(runJob).toContain("bash scripts/run.sh");
  });

  it("report job: no checkout, never runs student code, signs with the secret and posts to the callback", () => {
    expect(reportJob).not.toContain("actions/checkout");
    expect(reportJob).not.toContain("run.sh");
    expect(reportJob).not.toContain("codeB64");
    expect(reportJob).toMatch(/permissions: \{\}/);
    expect(reportJob).toContain("${{ secrets.JUDGE_WEBHOOK_SECRET }}");
    expect(reportJob).toContain("hmac.new(secret.encode(), body, hashlib.sha256)");
    expect(reportJob).toContain('-H "x-judge-signature: sha256=$signature"');
    expect(reportJob).toContain("/api/judge/callback");
  });

  it("puts the submissionId from the payload last, so harness output cannot override it", () => {
    expect(reportJob).toContain('{**results, "submissionId": submission_id}');
  });

  it("never interpolates ${{ }} inside a shell script (payload values arrive via env only)", () => {
    const blocks = scriptBlocks(workflow);
    expect(blocks).toHaveLength(2);
    for (const block of blocks) expect(block).not.toContain("${{");
  });
});

describe("run.sh", () => {
  it("applies every Docker limit from SPEC.md §9", () => {
    for (const flag of ["--network none", "--memory 256m", "--cpus 1", "--pids-limit 64", "--read-only", "--tmpfs /tmp"]) {
      expect(runSh).toContain(flag);
    }
    expect(runSh).toContain("--user 65534:65534");
    expect(runSh).toContain("--cap-drop ALL");
  });

  it("starts every container with those limits and mounts only the source (read-only) and build dirs", () => {
    expect(dockerRuns.length).toBeGreaterThanOrEqual(2);
    for (const command of dockerRuns) {
      expect(command).toContain('docker run "${DOCKER_LIMITS[@]}"');
      const mounts = [...command.matchAll(/-v "([^"]+)"/g)].map((m) => m[1]);
      expect(mounts.length).toBeGreaterThan(0);
      for (const mount of mounts) expect(mount).toMatch(/^\$(SRC:\/src:ro|BUILD:\/build:(ro|rw))$/);
    }
  });

  it("never mounts the tests or expected outputs, pipes input on stdin and uses a per-test timeout", () => {
    expect(runSh).not.toMatch(/-v "\$PROBLEM_DIR|-v "\$ROOT|-v "[^"]*tests/);
    expect(runSh).toContain('timeout -s KILL "$TIME_LIMIT_S" "${RUN_CMD[@]}" < "$input"');
    expect(runSh).toContain('"${UTIL[@]}" compare "$expected" "$actual"');
  });

  it("validates the slug and language, and uses the pinned images", () => {
    expect(runSh).toContain('[[ ! "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ || ${#SLUG} -gt 64 ]]');
    expect(runSh).toMatch(/\*\)\n\s+internal_error "Unsupported language."/);
    for (const image of ['IMAGE="gcc:13"', 'IMAGE="eclipse-temurin:21"', 'IMAGE="python:3.12-slim"']) {
      expect(runSh).toContain(image);
    }
    expect(runSh).toContain("g++ -O2 -std=c++17");
  });

  it("uses no secrets", () => {
    expect(runSh).not.toMatch(/secret|token/i);
  });

  it("stops at the first failure with the SPEC.md §8.3 verdicts", () => {
    for (const verdict of ["Accepted", "Wrong Answer", "Time Limit Exceeded", "Runtime Error", "Compilation Error"]) {
      expect(runSh).toContain(`"${verdict}"`);
    }
    expect(runSh).toMatch(/if \[\[ -n "\$verdict" \]\]; then[\s\S]*?exit 0/);
  });
});

describe("judge-repo files", () => {
  it("has a sample problem with problem.json and matching .in/.out tests", () => {
    const dir = "problems/sum-two-numbers";
    expect(JSON.parse(read(`${dir}/problem.json`))).toEqual({ timeLimitMs: 2000, memoryMb: 256 });
    const files = readdirSync(join(root, dir, "tests")).sort();
    expect(files).toEqual(["01.in", "01.out", "02.in", "02.out", "03.in", "03.out"]);
  });

  it("keeps LF line endings (bash on the Linux runner fails on CRLF)", () => {
    expect(read(".gitattributes")).toContain("eol=lf");
    for (const file of [".github/workflows/judge.yml", "scripts/run.sh", "scripts/judge_util.py"]) {
      expect(read(file)).not.toContain("\r");
    }
  });

  it("documents the callback payload and signature header in the README", () => {
    const readme = read("README.md");
    expect(readme).toContain("x-judge-signature: sha256=<hex>");
    expect(readme).toContain('"firstFailedTest"');
    expect(readme).toContain('"status": "error"');
  });
});
