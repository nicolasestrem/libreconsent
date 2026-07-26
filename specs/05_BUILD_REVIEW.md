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
- **Date / PR:** _pending_
- **Verdict:** _pending_
- **Findings:** —

### Phase 1 — Core
- **Date / PR:** _pending_
- **Verdict:** _pending_
- **Findings:** —

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
