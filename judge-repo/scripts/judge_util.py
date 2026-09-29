#!/usr/bin/env python3
"""Helpers for scripts/run.sh. Runs on the Actions host, never on student code.

  judge_util.py time-limit PROBLEM_JSON              -> prints the per-test limit in seconds (e.g. "2" or "2.5")
  judge_util.py compare EXPECTED ACTUAL              -> exit 0 if equal (trailing whitespace ignored), else 1
  judge_util.py result FILE VERDICT PASSED TOTAL [FIRST_FAILED] [COMPILE_OUTPUT_FILE]
  judge_util.py error FILE MESSAGE

results.json shapes (the report job adds "submissionId"; see README.md):
  {"status": "done", "judge": {"passed", "total", "verdict", "firstFailedTest"?}, "compileOutput"?}
  {"status": "error", "error": "<plain-English message>"}
"""

import json
import sys

VERDICTS = {"Accepted", "Wrong Answer", "Time Limit Exceeded", "Runtime Error", "Compilation Error"}
DEFAULT_TIME_LIMIT_MS = 2000
COMPILE_OUTPUT_LINES = 20
COMPILE_OUTPUT_CHARS = 4000


def time_limit(problem_json: str) -> str:
    with open(problem_json, encoding="utf-8") as f:
        problem = json.load(f)
    ms = problem.get("timeLimitMs", DEFAULT_TIME_LIMIT_MS)
    if not isinstance(ms, int) or isinstance(ms, bool) or not 100 <= ms <= 10000:
        raise ValueError(f"timeLimitMs must be an integer from 100 to 10000, got {ms!r}")
    seconds = ms / 1000
    return str(int(seconds)) if seconds.is_integer() else f"{seconds:g}"


def normalise(data: bytes) -> list[str]:
    """Lines with trailing whitespace removed, without trailing blank lines (CRLF and LF are equal)."""
    lines = [line.rstrip() for line in data.decode("utf-8", errors="replace").splitlines()]
    while lines and lines[-1] == "":
        lines.pop()
    return lines


def compare(expected: str, actual: str) -> int:
    with open(expected, "rb") as e, open(actual, "rb") as a:
        return 0 if normalise(e.read()) == normalise(a.read()) else 1


def first_lines(path: str) -> str:
    with open(path, encoding="utf-8", errors="replace") as f:
        lines = f.read().splitlines()[:COMPILE_OUTPUT_LINES]
    return "\n".join(lines)[:COMPILE_OUTPUT_CHARS]


def write(path: str, payload: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))


def result(path: str, verdict: str, passed: str, total: str, first_failed: str = "", compile_output: str = "") -> None:
    if verdict not in VERDICTS:
        raise ValueError(f"unknown verdict {verdict!r}")
    judge = {"passed": int(passed), "total": int(total), "verdict": verdict}
    if first_failed:
        judge["firstFailedTest"] = int(first_failed)
    payload: dict = {"status": "done", "judge": judge}
    if compile_output:
        payload["compileOutput"] = first_lines(compile_output)
    write(path, payload)


def main(argv: list[str]) -> int:
    command, args = argv[1], argv[2:]
    if command == "time-limit":
        print(time_limit(*args))
        return 0
    if command == "compare":
        return compare(*args)
    if command == "result":
        result(*args)
        return 0
    if command == "error":
        write(args[0], {"status": "error", "error": args[1]})
        return 0
    raise SystemExit(f"unknown command {command!r}")


if __name__ == "__main__":
    sys.exit(main(sys.argv))
