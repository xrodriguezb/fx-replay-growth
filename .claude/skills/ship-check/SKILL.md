---
name: ship-check
description: Run before calling a milestone or change done in the FX Replay project. Runs typecheck, unit tests, build and the Playwright signup journey through one deterministic script, then hands the real output plus the changed files to the read-only growth-reviewer agent. Use when the user says ship-check, "is this ready", or a milestone is closing.
argument-hint: "[milestone or paths to focus the review on]"
---

# /ship-check

Focus: $ARGUMENTS (if empty, everything `git status` reports).

## 1. Deterministic checks

Run `sh .claude/skills/ship-check/check.sh` from the project root and keep its output verbatim.
Don't swap in other commands, skip one, or paraphrase the result. If you want Redis coverage, start the local
stack from the README and set `REDIS_TEST_URL` first; the script says whether those tests ran.

## 2. Scope

Run `git status --short --untracked-files=all` to list what changed (staged, unstaged and untracked, file by
file). Narrow it to the focus above if one was given.

## 3. Independent review

Dispatch the `growth-reviewer` agent with:
- the file list from step 2,
- the check output from step 1, verbatim,
- the focus, and what's explicitly out of scope (later milestones).

Don't tell it what the code does or what you think is wrong. It has to read the code itself.

## 4. Report

```
CHECKS   <PASS/FAIL per check, from the script>
REVIEW   <verdict + findings table, as returned>
PENDING  <anything the checks can't prove, e.g. deployed API, real Upstash, GA4 reception>
```

## Rules

- A failing check means the change isn't done, whatever the review says.
- Don't fix findings in this skill. Each finding gets confirmed first (reproduce it with a failing test when
  possible), then fixed as normal work.
- Judgment log: you may add rows only as `proposed`, with check output you actually got. Say whether an issue was
  found by the reviewer, by a check, or by the human, and never mark anything `approved`.
