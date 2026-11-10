#!/bin/sh
# Same checks, same order, every time. Prints one line per check, plus the tail of the output when one fails.
# Exit code is non-zero if anything failed.

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 1
# shellcheck disable=SC1091
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use >/dev/null 2>&1

failed=0
log=$(mktemp)
trap 'rm -f "$log"' EXIT INT TERM

run() {
  name=$1; summary=$2; shift 2
  if "$@" >"$log" 2>&1; then
    printf 'PASS  %-10s %s\n' "$name" "$(grep -E "$summary" "$log" | tail -1 | sed 's/\x1b\[[0-9;]*m//g; s/^ *//; s/ *$//')"
  else
    failed=1
    printf 'FAIL  %s\n' "$name"
    tail -30 "$log" | sed 's/\x1b\[[0-9;]*m//g; s/^/      /'
  fi
}

# passing on the wrong runtime proves nothing, so a mismatch is a failure
want="v$(cat .nvmrc)"
if [ "$(node -v)" = "$want" ]; then
  printf 'PASS  %-10s %s\n' node "$want"
else
  failed=1
  printf 'FAIL  node       got %s, .nvmrc wants %s\n' "$(node -v)" "$want"
fi

run typecheck '[0-9]+ errors' npm run typecheck
run test 'Tests' npm test
if [ -n "$REDIS_TEST_URL" ]; then
  echo "      (store tests ran against REDIS_TEST_URL; a local proxy is not production Upstash)"
else
  echo "      (Redis store tests skipped: REDIS_TEST_URL not set)"
fi
run build 'Complete' npm run build
# starts its own dev server (or reuses one on :4321) and drives the signup in Chrome
run e2e 'passed' npx playwright test

exit $failed
