# 06 — Patch Plan

Tracks corrective work arising from 05_BUILD_REVIEW findings or field issues. Patches are small, spec-referenced, and land as their own PRs (never bundled into the next phase's PR).

## Format

| ID | Origin (review/issue) | Requirement IDs affected | Description | Severity | Status | PR |
|----|----------------------|--------------------------|-------------|----------|--------|-----|
| P-001 | Phase 1 build review | CORE-2, CORE-3, CORE-10 | Preserve FIFO ordering through reentrant listeners, isolate consumer callback errors, clone queued/replayed payloads, and make undecided withdrawal emit `change`. | blocker | done | [#2](https://github.com/nicolasestrem/libreconsent/pull/2) |
| P-002 | Phase 1 build review | CORE-4, CORE-5, CORE-11 | Use prototype-safe choice maps and reject stored states with invalid UUID/revision/canonical UTC timestamps. | blocker | done | [#2](https://github.com/nicolasestrem/libreconsent/pull/2) |
| P-003 | Phase 1 build review | CFG-3, CFG-6, CORE-1 | Compare normalized record keys canonically and validate enabled effective Consent Mode mappings plus unknown signals. | major | done | [#2](https://github.com/nicolasestrem/libreconsent/pull/2) |
| P-004 | Phase 1 PR CI | TOOL-4 | Use Node's canonical `--no-experimental-webstorage` flag so the inherited Vitest guard is accepted by both Node 24 CI and Node 26 development. | blocker | done | [#2](https://github.com/nicolasestrem/libreconsent/pull/2) |
| P-005 | PR #2 review | CORE-3, CORE-10 | Keep decisions after an initial withdrawal on `change`, and isolate exceptions from replayed `ready` / `consent` callbacks. | major | done | [#2](https://github.com/nicolasestrem/libreconsent/pull/2) |
| P-006 | PR #2 review | CORE-3, CORE-4, CORE-5 | Queue reentrant listener decisions for FIFO delivery and clamp changed-state timestamps against backward wall-clock adjustments. | major | done | [#2](https://github.com/nicolasestrem/libreconsent/pull/2) |
| P-007 | Phase 1 phase-gate audit | TOOL-1..5 | Enforce the completed-phase marker and exactly one passing, non-empty, file-backed traceability row for every requirement through that phase. | blocker | done | This PR |
| P-008 | Phase 1 documentation audit | TOOL-5 | Replace the root README's obsolete Phase 0 stub status with the completed Phase 1 scope and next milestone. | minor | done | This PR |
| P-009 | PR #3 review | TOOL-4 | Require verification evidence to identify a configured runnable test or supported named CI check, not merely an existing file. | P1 | done | This PR |
| P-010 | Phase 2 implementation | CM-1..6 | Implement Google Consent Mode defaults/updates, compiled inline fixtures, current Google-doc alignment, and operator deployment guidance. | major | done | This PR |
| P-011 | PR #5 review | TOOL-3, CM-1..6 | Complete the Phase 2 gate record and fail fixture-server requests fast when the compiled head artifact is unavailable. | minor | done | [#5](https://github.com/nicolasestrem/libreconsent/pull/5) |
| P-012 | PR #5 review | CM-1, CM-4 | Treat omitted standalone `enabled` as disabled, and record CM-4's Phase 2 documentation versus Phase 3 BLK/network-silence boundary in D-019. | P1 | done | [#5](https://github.com/nicolasestrem/libreconsent/pull/5) |
| P-013 | Phase 3 implementation | BLK-1, BLK-2, BLK-3, BLK-5 | Implement declarative script/embed gating with document-order execution, CSP nonce propagation, i18n placeholders, withdrawal re-blocking, and the flagship pre-consent network-silence E2E with real `gtag.js`. | major | done | This PR |
| P-014 | Phase 3 flagship E2E | CM-1, BLK-1 | `examples/basic-site` passed a placeholder string to `gtag("js", …)`; real `gtag.js` requires a `Date` and fired no tag at all, so the post-accept collect assertion could never pass and the pre-consent silence assertions were vacuous. Fixture now passes a real `Date`; the CM-1 ordering assertion checks the command's position and shape instead of a value that cannot be pinned. | major | done | This PR |
| P-015 | PR #6 review | BLK-1, BLK-5 | A gate queued under a grant executed even if consent was withdrawn while the queue was parked on a slower gate, so with the default `reloadOnWithdraw: false` a tracker could start after withdrawal. Each gate's grant is now re-read immediately before it executes, and a skipped gate stays eligible for a later grant. | major | done | This PR |
| P-016 | PR #6 review | BLK-1 | An inline `data-cmp-type="module"` gate resolved as if it were a classic inline script, but module evaluation is deferred, so a following classic gate could run ahead of it and break the document-order guarantee. Inline modules are now awaited through `load`/`error`. | minor | done | This PR |
| P-017 | PR #6 review | BLK-3 | Blocking removed `src` from every non-script gate while `reveal()` restored one only for iframes, so a generic `data-cmp-placeholder` gate on a src-bearing element (`img`, `video`) was permanently broken by consent. Removal is now confined to iframe gates, and the documentation states that a generic placeholder hides content rather than suppressing requests. | major | done | This PR |

**Severity:** `blocker` (phase gate violated / guardrail breach) · `major` (spec deviation, user-visible) · `minor` (docs, polish).
**Status:** `open` → `planned` → `done` / `wontfix (log rationale in DECISION_LOG)`.

## Rules

1. A `blocker` patch stops the phase train: no new phase starts until it's `done`.
2. A patch that changes spec behavior requires a DECISION_LOG entry and, if material, a spec edit with changelog note in 08_CHANGELOG_AI.md.
3. Weakening any test assertion is never a patch — that's a spec change and goes through rule 2.

## Open patches

_None. P-001..P-008 were fixed and regression-tested within the Phase 1 review cycle._
