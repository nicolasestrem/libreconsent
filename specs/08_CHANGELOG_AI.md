# 08 — AI Changelog

Append-only log of AI-performed work on this spec pack and the build. Newest first. Format: date · actor · phase/scope · summary.

| Date | Actor | Scope | Summary |
|------|-------|-------|---------|
| 2026-07-26 | Codex | PR #5 review follow-up | Made omitted standalone Consent Mode enablement side-effect-free and recorded D-019 for CM-4's Phase 2 documentation versus Phase 3 BLK delivery boundary. |
| 2026-07-26 | Codex | PR #5 review follow-up | Completed the Phase 2 gate record and made fixture artifact-read failure return a clear HTTP 500 response. |
| 2026-07-26 | Codex | Phase 2 Consent Mode (CM-1..6) | Added head defaults, lifecycle updates, redaction/URL settings, regional/GTM fixtures, current Google-source records, and Phase 2 traceability. |
| 2026-07-26 | Codex | Phase 1 phase-gate prerequisite (TOOL-1..5) | Added completed-phase traceability enforcement with valid/broken fixtures and CI integration; corrected stale root status documentation. |
| 2026-07-26 | Codex | PR #3 review follow-up | Restricted traceability verification evidence to configured test files or supported named CI checks; added the non-test-file regression. |
| 2026-07-26 | Codex | Phase 1 review follow-up (CORE-3..5) | Queued reentrant decisions for FIFO event delivery, clamped timestamps across wall-clock rollback, and added focused regressions without replying to or resolving PR threads. |
| 2026-07-26 | Codex | Phase 1 CI/review follow-up (TOOL-4, CORE-3, CORE-10) | Fixed Node 24 CI with the canonical Web Storage guard; kept post-withdrawal decisions on `change`; isolated throwing replay callbacks; added focused regressions. |
| 2026-07-26 | Codex | Phase 1 core (CFG-1..7, CFG-9, CORE-1..11) | Implemented and documented the core configuration, consent lifecycle, events, region resolution, and cookie/localStorage contracts. Local verification passes; PR #2 opened for review. |
| 2026-07-26 | Codex | Phase 0 scaffold | Added pnpm workspace tooling, four typed stubs, static fixtures, CI gates, size budgets, NO_TCF, and traceability header. Local `pnpm check` and GitHub Actions are green. |
| 2026-07-26 | Claude (spec author) | Naming (D-001) | Project named **libreconsent** (was placeholder "cmpkit"); renamed across all pack files incl. package scope `@libreconsent/*`, cookie name, CSS var prefix. npm name/scope + GitHub org verified free 2026-07-26 — register before Phase 0. |
| 2026-07-26 | Claude (spec author) | Spec pack v1 | Created full specs-first pack (00–08 + DECISION_LOG) from feasibility brief v2. Scope: Consent-Mode-v2-native FOSS CMP + US module + bridge mode; TCF permanently excluded (G-1). Build not started; current phase: none (next: Phase 0 per 04 §4). |

## Conventions for future entries

- One row per Claude Code session (or meaningful spec edit), appended at the top of the table.
- Reference phase numbers (02 §3) and requirement IDs where relevant.
- Spec changes must also appear in DECISION_LOG if they alter agreed behavior.
- Keep summaries ≤ 2 lines; details belong in PR descriptions and 05_BUILD_REVIEW.md.
