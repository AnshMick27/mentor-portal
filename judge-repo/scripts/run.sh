#!/usr/bin/env bash
# Judge harness (SPEC.md §9). Runs on the GitHub Actions host; the student's code only ever runs inside
# the Docker containers started below (no network, capped memory/CPU/processes, read-only root).
#
# Inputs (environment):
#   PROBLEM_SLUG   folder under problems/ (lowercase-kebab)
#   LANGUAGE       cpp | java | python
#   CODE_B64       the source code, base64
#   RESULTS_FILE   where to write results.json (see scripts/judge_util.py and README.md)
#
# Always exits 0 after writing RESULTS_FILE, so the report job can tell the app what happened.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UTIL=(python3 "$ROOT/scripts/judge_util.py")
: "${RESULTS_FILE:?RESULTS_FILE is required}"

MAX_CODE_BYTES=32768
COMPILE_TIMEOUT_S=60
MAX_OUTPUT_BYTES=1048576

# Limits for EVERY container. Expected outputs are never mounted; only the source (read-only) and the build dir.
DOCKER_LIMITS=(
  --rm -i
  --network none
  --memory 256m --memory-swap 256m
  --cpus 1
  --pids-limit 64
  --read-only
  --tmpfs /tmp:rw,size=64m
  --user 65534:65534
  --cap-drop ALL
  --security-opt no-new-privileges
  -e HOME=/tmp
)

WORK=""
written=false

internal_error() {
  "${UTIL[@]}" error "$RESULTS_FILE" "$1"
  written=true
  exit 0
}

on_exit() {
  local status=$?
  if [[ "$written" != true ]]; then
    echo "run.sh failed unexpectedly (exit $status)" >&2
    "${UTIL[@]}" error "$RESULTS_FILE" "The judge had an internal error." || true
  fi
  if [[ -n "$WORK" ]]; then rm -rf "$WORK"; fi
  exit 0
}
trap on_exit EXIT

# --- Validate inputs ---------------------------------------------------------------------------------
SLUG="${PROBLEM_SLUG:-}"
if [[ ! "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ || ${#SLUG} -gt 64 ]]; then
  internal_error "Invalid problem slug."
fi
PROBLEM_DIR="$ROOT/problems/$SLUG"
if [[ ! -f "$PROBLEM_DIR/problem.json" || ! -d "$PROBLEM_DIR/tests" ]]; then
  internal_error "Problem '$SLUG' is not set up in the judge repo."
fi

case "${LANGUAGE:-}" in
  cpp)
    IMAGE="gcc:13"; SOURCE="Main.cpp"
    COMPILE_CMD=(g++ -O2 -std=c++17 -o /build/main /src/Main.cpp)
    RUN_CMD=(/build/main) ;;
  java)
    IMAGE="eclipse-temurin:21"; SOURCE="Main.java"
    COMPILE_CMD=(javac -J-Xmx192m -J-XX:+UseSerialGC -d /build /src/Main.java)
    RUN_CMD=(java -Xmx192m -Xss64m -XX:+UseSerialGC -XX:-UsePerfData -cp /build Main) ;;
  python)
    IMAGE="python:3.12-slim"; SOURCE="main.py"
    # Syntax check only (reported as a compilation error); nothing is written.
    COMPILE_CMD=(python3 -c "import sys; compile(open('/src/main.py', encoding='utf-8').read(), 'main.py', 'exec')")
    RUN_CMD=(python3 -B /src/main.py) ;;
  *)
    internal_error "Unsupported language." ;;
esac

TIME_LIMIT_S="$("${UTIL[@]}" time-limit "$PROBLEM_DIR/problem.json")" || internal_error "Invalid problem.json."
LIMIT_MS=$(awk -v s="$TIME_LIMIT_S" 'BEGIN { printf "%d", s * 1000 }')

mapfile -t INPUTS < <(find "$PROBLEM_DIR/tests" -maxdepth 1 -name '*.in' | sort)
TOTAL=${#INPUTS[@]}
if (( TOTAL == 0 )); then internal_error "Problem '$SLUG' has no tests."; fi
for input in "${INPUTS[@]}"; do
  [[ -f "${input%.in}.out" ]] || internal_error "Test $(basename "$input") has no .out file."
done

# --- Prepare the workspace -----------------------------------------------------------------------------
WORK="$(mktemp -d)"
SRC="$WORK/src"; BUILD="$WORK/build"; OUT="$WORK/out"
mkdir -p "$SRC" "$BUILD" "$OUT"
chmod 755 "$WORK" "$SRC"
chmod 777 "$BUILD"   # the unprivileged container user writes the compiled program here

printf '%s' "${CODE_B64:-}" | base64 -d > "$SRC/$SOURCE" 2>/dev/null || internal_error "The submitted code could not be decoded."
chmod 644 "$SRC/$SOURCE"
CODE_BYTES=$(wc -c < "$SRC/$SOURCE")
if (( CODE_BYTES == 0 || CODE_BYTES > MAX_CODE_BYTES )); then internal_error "The submitted code is empty or too large."; fi

docker pull -q "$IMAGE" > /dev/null || internal_error "Could not prepare the $LANGUAGE runtime."

# --- Compile -------------------------------------------------------------------------------------------
set +e
docker run "${DOCKER_LIMITS[@]}" -v "$SRC:/src:ro" -v "$BUILD:/build:rw" "$IMAGE" \
  timeout -s KILL "$COMPILE_TIMEOUT_S" "${COMPILE_CMD[@]}" < /dev/null > "$OUT/compile.txt" 2>&1
compile_status=$?
set -e
if (( compile_status == 125 )); then internal_error "Could not start the compiler."; fi
if (( compile_status != 0 )); then
  "${UTIL[@]}" result "$RESULTS_FILE" "Compilation Error" 0 "$TOTAL" "" "$OUT/compile.txt"
  written=true
  exit 0
fi

# --- Run each test, stopping at the first failure ------------------------------------------------------
passed=0
for i in "${!INPUTS[@]}"; do
  input="${INPUTS[$i]}"
  expected="${input%.in}.out"
  actual="$OUT/actual.txt"
  test_number=$((i + 1))

  start_ns=$(date +%s%N)
  set +e
  docker run "${DOCKER_LIMITS[@]}" -v "$SRC:/src:ro" -v "$BUILD:/build:ro" "$IMAGE" \
    timeout -s KILL "$TIME_LIMIT_S" "${RUN_CMD[@]}" < "$input" 2> /dev/null \
    | head -c "$MAX_OUTPUT_BYTES" > "$actual"
  run_status=${PIPESTATUS[0]}
  set -e
  elapsed_ms=$(( ($(date +%s%N) - start_ns) / 1000000 ))

  verdict=""
  if (( run_status == 125 )); then
    internal_error "Could not start the program."
  elif (( run_status == 137 && elapsed_ms >= LIMIT_MS )); then
    verdict="Time Limit Exceeded"   # killed by `timeout -s KILL`
  elif (( run_status != 0 )); then
    verdict="Runtime Error"         # crash, non-zero exit, out of memory, or output over 1 MB
  elif ! "${UTIL[@]}" compare "$expected" "$actual"; then
    verdict="Wrong Answer"
  fi

  if [[ -n "$verdict" ]]; then
    "${UTIL[@]}" result "$RESULTS_FILE" "$verdict" "$passed" "$TOTAL" "$test_number"
    written=true
    exit 0
  fi
  passed=$((passed + 1))
done

"${UTIL[@]}" result "$RESULTS_FILE" "Accepted" "$passed" "$TOTAL"
written=true
