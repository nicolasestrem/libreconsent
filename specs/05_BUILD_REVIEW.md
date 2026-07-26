# 05 — Build Review

Filled by Claude Code after each phase (protocol: 04 §1.5). One section per phase; findings that require work become entries in 06_PATCH_PLAN.md.

## Review checklist (apply each phase)

- [ ] All phase requirement IDs implemented and mapped in TRACEABILITY.md
- [ ] All phase tests green in CI (unit, E2E, a11y, size as applicable)
- [ ] Guardrails G-1..G-6 spot-checked (grep for `__tcfapi` writes, `eval`, `innerHTML`, new runtime deps, pre-decision storage)
- [ ] Flagship `pre-consent-network-silence` still green (Phase ≥3)
- [ ] Docs updated for anything public-facing
- [ ] research-at-implementation items: source + date cited in PR (CM-6, US-4)
- [ ] No weakened test assertions vs spec (03 §11.2 endpoints list intact)

## Phase reviews

### Phase 0 — Scaffold
- **Date / PR:** 2026-07-26 / [#1](https://github.com/nicolasestrem/libreconsent/pull/1)
- **Verdict:** pass — local `pnpm check` and GitHub Actions **All gates** passed.
- **Findings:** None. The Phase 0 prompt requires empty typed stubs and an empty traceability table, so no functional requirement rows exist yet.

### Phase 1 — Core
- **Date / PR:** 2026-07-26 / [#2](https://github.com/nicolasestrem/libreconsent/pull/2)
- **Scope:** CFG-1..7, CFG-9, CORE-1..11.
- **Verdict:** pass — focused core tests and the full local gate are green; CI and review follow-ups are fixed and regression-tested.
- **Verification:** core 73/73 on Node 24 and Node 26; full unit suite 81/81 including 5/5 phase-gate tests; `pnpm check` passed; `git diff --check` passed.
- **Measured size:** core IIFE 5.60 KB gzip (8 KB limit); core+ui, bridge, and head-snippet budgets also passed.
- **Guardrails:** core/ui/bridge have zero runtime dependencies; prohibited-construct scan found no TCF provider/emission, `eval`, `new Function`, or config-driven `innerHTML`; storage writes remain decision/reconciliation/reset-only and the absolute pre-decision test passes.
- **Documentation:** public API/configuration, lifecycle events, persistence/recovery, revision prefill, region strict mode, and a Cloudflare resolver pattern are documented.
- **Phase-gate follow-up:** the completed phase is now machine-readable in `TRACEABILITY.md`; TOOL-1..5 and all requirements through Phase 1 are enforced by `pnpm traceability`, `pnpm check`, and a dedicated CI step.
- **Findings:** lifecycle reentrancy/defensive-copy hardening, stored-state validation, config-equivalence/mapping validation, cross-version Vitest startup, replay exception isolation, post-withdrawal event routing, FIFO reentrant delivery, monotonic timestamps, the missing traceability gate, the stale root status, and runnable verification evidence were found in review/CI, fixed, regression-tested, and logged as P-001..P-009.

### Phase 2 — Consent Mode
- **Date / PR:** _pending_ · **CM-6 doc version consulted:** _pending_
- **Verdict:** _pending_
- **Findings:** —

### Phase 3 — Blocking
- **Date / PR:** _pending_
- **Verdict:** _pending_
- **Findings:** —

### Phase 4 — UI
- **Date / PR:** _pending_ · **axe result:** _pending_
- **Verdict:** _pending_
- **Findings:** —

### Phase 5 — Hardening
- **Date / PR:** _pending_ · **Measured sizes:** core ___ / core+ui ___ / bridge ___ / snippet ___
- **Verdict:** _pending_
- **Findings:** —

### Phase 6 — US module
- **Date / PR:** _pending_ · **US-4 doc version consulted:** _pending_
- **Verdict:** _pending_
- **Findings:** —

### Phase 7 — Bridge
- **Date / PR:** _pending_ · **G-1 audit (no writes/emissions):** _pending_
- **Verdict:** _pending_
- **Findings:** —

### Phase 8 — Worker log
- **Date / PR:** _pending_ · **PII audit (no IP/UA):** _pending_
- **Verdict:** _pending_
- **Findings:** —

### Phase 9 — Release
- **Date / PR:** _pending_ · **TRACEABILITY audit:** _pending_
- **Verdict:** _pending_
- **Findings:** —
