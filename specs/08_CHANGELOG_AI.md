# 08 — AI Changelog

Append-only log of AI-performed work on this spec pack and the build. Newest first. Format: date · actor · phase/scope · summary.

| Date | Actor | Scope | Summary |
|------|-------|-------|---------|
| 2026-07-26 | Codex | Phase 1 core (CFG-1..7, CFG-9, CORE-1..11) | Implemented and documented the core configuration, consent lifecycle, events, region resolution, and cookie/localStorage contracts. Local verification passes; PR #2 opened for review. |
| 2026-07-26 | Codex | Phase 0 scaffold | Added pnpm workspace tooling, four typed stubs, static fixtures, CI gates, size budgets, NO_TCF, and traceability header. Local `pnpm check` and GitHub Actions are green. |
| 2026-07-26 | Claude (spec author) | Naming (D-001) | Project named **libreconsent** (was placeholder "cmpkit"); renamed across all pack files incl. package scope `@libreconsent/*`, cookie name, CSS var prefix. npm name/scope + GitHub org verified free 2026-07-26 — register before Phase 0. |
| 2026-07-26 | Claude (spec author) | Spec pack v1 | Created full specs-first pack (00–08 + DECISION_LOG) from feasibility brief v2. Scope: Consent-Mode-v2-native FOSS CMP + US module + bridge mode; TCF permanently excluded (G-1). Build not started; current phase: none (next: Phase 0 per 04 §4). |

## Conventions for future entries

- One row per Claude Code session (or meaningful spec edit), appended at the top of the table.
- Reference phase numbers (02 §3) and requirement IDs where relevant.
- Spec changes must also appear in DECISION_LOG if they alter agreed behavior.
- Keep summaries ≤ 2 lines; details belong in PR descriptions and 05_BUILD_REVIEW.md.
