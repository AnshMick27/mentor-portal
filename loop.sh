#!/usr/bin/env bash
# Runs the build loop: each iteration = Claude Code builds ONE task from PROGRESS.md.
# Usage:  ./loop.sh        (default: up to 3 iterations)
#         ./loop.sh 6      (up to 6 iterations)
# Stop any time: create a file named STOP in the project root, or press Ctrl+C.
# On Windows, run this from Git Bash or WSL.

set -uo pipefail

MAX_ITER="${1:-3}"
LOG_DIR=".loop-logs"
mkdir -p "$LOG_DIR"

ALLOWED_TOOLS="Read,Edit,Write,Glob,Grep,Bash(npm:*),Bash(npx:*),Bash(node:*),Bash(firebase emulators:exec:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*),Bash(git add:*),Bash(git commit:*)"

for i in $(seq 1 "$MAX_ITER"); do
  if [ -f STOP ]; then
    echo "STOP file found. Exiting."
    exit 0
  fi

  LOG="$LOG_DIR/iter-$(date +%Y%m%d-%H%M%S).log"
  echo "=== Iteration $i of $MAX_ITER  (log: $LOG) ==="

  claude -p "$(cat LOOP.md)" \
    --permission-mode acceptEdits \
    --allowedTools "$ALLOWED_TOOLS" \
    --max-turns 80 2>&1 | tee "$LOG"

  STATUS=$(grep -o 'LOOP_STATUS: [A-Z_]*' "$LOG" | tail -1 | awk '{print $2}')

  case "$STATUS" in
    TASK_DONE)
      echo ">>> Task done. Continuing."
      ;;
    HUMAN_CHECKPOINT)
      echo ">>> Your turn: a HUMAN step is next. Read the output above and PROGRESS.md."
      echo ">>> When finished, tick it in PROGRESS.md ( - [x] ), commit, and run ./loop.sh again."
      exit 0
      ;;
    BLOCKED)
      echo ">>> Blocked. See 'Blockers' in PROGRESS.md."
      exit 1
      ;;
    ALL_DONE)
      echo ">>> All tasks in the current loop are done."
      exit 0
      ;;
    *)
      echo ">>> No LOOP_STATUS found. Stopping for safety. Check $LOG."
      exit 1
      ;;
  esac
done

echo "Reached $MAX_ITER iterations. Review the commits (git log), then run ./loop.sh again."
