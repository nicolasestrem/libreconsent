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
- **Date / PR:** 2026-07-26 · [#5](https://github.com/nicolasestrem/libreconsent/pull/5)
- **Google research (CM-6):** accessed 2026-07-26: [Consent Mode setup guide](https://developers.google.com/tag-platform/security/guides/consent) (updated 2026-05-06), [Google tag API reference](https://developers.google.com/tag-platform/gtagjs/reference) (updated 2026-04-17), and [GTM consent-template APIs](https://developers.google.com/tag-platform/tag-manager/templates/consent-apis) (updated 2026-03-05). The API reference now explicitly requires `wait_for_update` to be a positive integer; configuration validation was tightened accordingly.
- **Implementation:** the actual built head artifact creates/preserves `dataLayer` and `gtag`, queues deny defaults before Google commands, supports regional deny/global-grant defaults, and queues configured redaction/URL-passthrough settings. The core sends isolated four-signal updates from replayed/restored and later consent events.
- **Verification:** focused core/head unit coverage plus compiled-artifact E2E prove basic `default` ordering before `js`/`config` and GTM defaults before the Consent Initialization marker. Final `pnpm check` passed on 2026-07-26: traceability through Phase 2 (30 requirements), 95 unit tests, all package builds, size budgets (core 5.77 kB; core+ui 6.08 kB; bridge 318 B; head 710 B gzip), 5 E2E tests, and 3 accessibility tests.
- **Scope:** basic mode is documented as the recommended finished deployment, not as Phase 2 functionality; it requires the declarative BLK gate in Phase 3. Advanced mode's pre-consent cookieless-ping tradeoff is documented. Declarative blocking and real pre-consent network silence remain Phase 3; no GTM Community Template is included.
- **Verdict:** pass
- **Findings:** PR #5 review found the unfinished phase record, an unhandled fixture-artifact read, an omitted `enabled` bootstrap value incorrectly failing closed, and ambiguous CM-4 phase wording. The final gate is recorded; missing artifacts return HTTP 500; an omitted `enabled` value is side-effect-free; and CM-4 now explicitly reserves basic-mode gating for Phase 3 (P-011, P-012).

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
