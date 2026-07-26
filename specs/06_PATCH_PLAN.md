# 06 — Patch Plan

Tracks corrective work arising from 05_BUILD_REVIEW findings or field issues. Patches are small, spec-referenced, and land as their own PRs (never bundled into the next phase's PR).

## Format

| ID | Origin (review/issue) | Requirement IDs affected | Description | Severity | Status | PR |
|----|----------------------|--------------------------|-------------|----------|--------|-----|
| P-001 | _example — remove when first real entry lands_ | — | — | — | — | — |

**Severity:** `blocker` (phase gate violated / guardrail breach) · `major` (spec deviation, user-visible) · `minor` (docs, polish).
**Status:** `open` → `planned` → `done` / `wontfix (log rationale in DECISION_LOG)`.

## Rules

1. A `blocker` patch stops the phase train: no new phase starts until it's `done`.
2. A patch that changes spec behavior requires a DECISION_LOG entry and, if material, a spec edit with changelog note in 08_CHANGELOG_AI.md.
3. Weakening any test assertion is never a patch — that's a spec change and goes through rule 2.

## Open patches

_None yet — build not started._
