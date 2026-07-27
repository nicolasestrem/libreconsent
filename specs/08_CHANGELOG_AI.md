# 08 — AI Changelog

Append-only log of AI-performed work on this spec pack and the build. Newest first. Format: date · actor · phase/scope · summary.

| Date | Actor | Scope | Summary |
|------|-------|-------|---------|
| 2026-07-27 | Claude Code | NFR-1 re-baseline (§10, G-3) | Re-baselined the size budgets once from measurement at the maintainer's request: core 8 → 12 KB, core+ui 15 → 19 KB, moved together because the UI's ~6.7 KB made the combined cap the real gate. Projection and ratchet rule recorded in D-042. |
| 2026-07-27 | Claude Code | PR #8 review follow-up (BLK-4) | Fixed a script whose URL arrives a task after its insertion being silenced but never registered, so no grant could replay it. The report's own same-task case was not a defect (observer callbacks are microtasks) and is now pinned by a test. P-028. |
| 2026-07-27 | Claude Code | Phase 5 self-review (BLK-1, BLK-4) | Fixed four defects found by adversarial review, three blockers: a blocklist inverted BLK-1's document order, the net failed open on non-string URLs (Trusted Types), `type` reset resurrected a gated script, and a gated module was replayed as a classic script. P-024..P-027, D-040, D-041. |
| 2026-07-27 | Claude Code | Phase 5 hardening (BLK-4, NFR-1..4) | Added the opt-in `blocking.blocklist` net, which diverts a matching script's URL so it has nothing to fetch; the planned detach-and-veto technique was proven ineffective in Chromium and replaced (P-023, D-037). Added a permanent guardrail scan and a layout-shift gate. D-036..D-039. |
| 2026-07-27 | Claude Code | Phase 5 audits (§10, §11.3) | Turned the per-phase manual G-1/G-2/G-6 greps into `scripts/guardrails.test.mjs`, added `specs/SECURITY_CHECKLIST.md`, and recorded that core now has 0.16 kB of its 8 kB budget left — Phase 6 needs a size decision first. |
| 2026-07-27 | Claude Code | PR #7 review follow-up (UI-3) | Gave each layer its own focus-trap release function so opening preferences over a modal-layout banner can no longer leak the banner's listener or misdirect `closeBanner()`. P-022. |
| 2026-07-27 | Claude Code | Phase 4 UI (UI-1..8) | Added `@libreconsent/ui`: shadow-DOM banner and preferences modal, custom-property theming, EN+FR renderer dictionaries, focus management, and re-entry points. Core gained `registerRenderer()` and `ready.region` only. D-027..D-033 recorded. |
| 2026-07-27 | Claude Code | Phase 4 gates (§11.3, §11.4) | Keyboard-only accept and reject journeys, equal-prominence check, and axe-core on both layers in light and dark themes. Two defects the gates caught are recorded as P-019 and P-020. |
| 2026-07-27 | Claude Code | PR #6 review follow-up 2 (BLK-5) | Split gate queue state from execution state so `reloadOnWithdraw` cannot discard the page for a gate that never entered the document. P-018. |
| 2026-07-27 | Claude Code | PR #6 review follow-up (BLK-1, BLK-3, BLK-5) | Re-read each gate's consent before it executes so withdrawal stops a queued gate; awaited inline modules; confined `src` removal to iframe gates; corrected D-025's dropped `sendBeacon` deletion. P-015..P-017. |
| 2026-07-26 | Claude Code | Phase 3 blocking (BLK-1..3, BLK-5) | Added declarative script/embed gating with document-order execution, nonce propagation, i18n placeholders, and `reloadOnWithdraw`; D-020..D-026 recorded. |
| 2026-07-26 | Claude Code | Phase 3 flagship E2E (spec §11.2) | Proved pre-consent network silence with real vendored `gtag.js`; fixed the fixture's non-Date `gtag("js", …)` that had suppressed every tag and would have made the assertions vacuous. |
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
