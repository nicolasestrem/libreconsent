# 04 — Claude Code Build Prompt & Execution Protocol

## 1. Execution protocol

1. Create the repo; copy this `specs/` pack into `repo/specs/`; place the CLAUDE.md from §3 at the repo root.
2. Execute **one phase per session/PR**, in order (03 §12). Open each phase in plan mode.
3. A phase is done only when its DoD is met AND every requirement ID it covers has a row in `specs/TRACEABILITY.md` pointing at ≥1 passing test.
4. Never implement a requirement without a test. Never start phase N+1 with phase N CI red.
5. `05_BUILD_REVIEW.md` is filled after each phase (§4 below); findings become entries in `06_PATCH_PLAN.md`; every session appends to `08_CHANGELOG_AI.md`.
6. Where the spec says *research-at-implementation* (CM-6, US-4): fetch the live Google docs, implement against them, and record the consulted doc + date in the PR description.

## 2. Global guardrails

- **G-1 — No TCF.** Never emit a TC string, never provide `__tcfapi`, never claim a CMP ID. Read-only `__tcfapi` *consumption* in `packages/bridge` is the sole exception. Create `specs/NO_TCF.md` in Phase 0 documenting the rationale for contributors (certified-CMP economics, 01 §1).
- **G-2 —** Zero third-party runtime dependencies in core/ui/bridge. The UI's
  required peer on a compatible `@libreconsent/core` is the sole first-party
  package relationship.
- **G-3 —** Size budgets (03 NFR-1) are hard CI failures.
- **G-4 —** Nothing stored client-side before a user decision (CORE-8).
- **G-5 —** Every user-facing string comes from the i18n layer.
- **G-6 —** No `eval` / `new Function` / `innerHTML` with config-provided strings.

## 3. CLAUDE.md (verbatim, repo root)

```markdown
# libreconsent — instructions for Claude Code

Read specs/03_MASTER_PRODUCTION_SPEC.md before any change.
Work one phase at a time (spec §12). Current phase: see specs/08_CHANGELOG_AI.md.

## Hard rules
- NEVER add TCF support: no TC string emission, no __tcfapi provider, no CMP ID.
  Read-only __tcfapi consumption in packages/bridge is the only exception. (G-1)
- Zero third-party runtime dependencies in core/ui/bridge; UI may require core
  as its sole first-party peer. (G-2)
- Size budgets are hard CI failures — run `pnpm size` before committing. (G-3)
- Nothing is stored client-side before a user decision. (CORE-8)
- No eval / new Function / innerHTML with config strings. (G-6)
- Every requirement implemented gets a test and a row in specs/TRACEABILITY.md.
- For Google-specific behavior (consent mode, RDP): fetch current Google docs at
  implementation time; cite source + date in the PR description. (CM-6, US-4)
- After each phase: fill specs/05_BUILD_REVIEW.md, log patches in
  specs/06_PATCH_PLAN.md, append to specs/08_CHANGELOG_AI.md.

## Commands
pnpm install · pnpm build · pnpm test · pnpm e2e · pnpm size · pnpm lint · pnpm check

## Conventions
TypeScript strict; ESM source; tsup builds ESM+IIFE; conventional commits;
public API only from package roots; TSDoc on all exports.
```

## 4. Per-phase session prompts

Use these as the opening message of each Claude Code session (adjust paths if needed).

**Phase 0 — Scaffold**
> Read specs/03_MASTER_PRODUCTION_SPEC.md §1 and CLAUDE.md. Plan, then scaffold the pnpm monorepo exactly as specified (TOOL-1..5): packages core/ui/bridge/worker-log as empty typed stubs, examples/, GitHub Actions CI with all gates including size-limit budgets from NFR-1 running against the stubs, Biome, Vitest, Playwright wiring. Create specs/NO_TCF.md and an empty specs/TRACEABILITY.md with the table header. DoD: CI fully green.

**Phase 1 — Core**
> Read spec §2–3 (CFG-1..9 except CFG-8, CORE-1..11). Plan, then implement @libreconsent/core state, config validation, storage, expiry, revision. Unit tests for every ID including corruption handling (CORE-5) and the no-persistence-before-decision rule (CORE-8). Update TRACEABILITY.

**Phase 2 — Consent Mode**
> Read spec §4 (CM-1..6). First fetch https://developers.google.com/tag-platform/security/guides/consent and note deltas vs the spec. Implement the head snippet (≤1.5KB), default/update wiring, mappings, ads_data_redaction, region strategies. E2E: consent `default` present in dataLayer before any gtag command on examples/basic-site.

**Phase 3 — Blocking**
> Read spec §5 (BLK-1..3, BLK-5). Implement declarative script gating with order preservation, nonce propagation, iframe placeholders. Then build the flagship E2E `pre-consent-network-silence` (03 §11.2) with real gtag.js and make it green. Do not weaken its assertions to make it pass; the endpoint list in 03 §11.2 is fixed.

**Phase 4 — UI**
> Read spec §6 (UI-1..8). Implement banner + preferences modal in Shadow DOM, CSS-custom-property theming, EN+FR dictionaries, focus management. Gates: axe-core zero critical/serious; keyboard-only E2E completing BOTH accept and reject journeys; equal-prominence check.

**Phase 5 — Hardening**
> Read spec §5 BLK-4 and §10 NFR-1..4. Implement the MutationObserver safety net, documented as best-effort (not guaranteed). Then audit: real-code size budgets, CSP fixture, security checklist (G-6), CLS check. Fill 05_BUILD_REVIEW for phases 1–5.

**Phase 6 — US module**
> Read spec §7 (US-1..4, CFG-8). Fetch current Google RDP/US-states docs first; write specs/US_NOTES.md. Implement GPC auto-opt-out, Do-Not-Sell dialog, coexisting EU-opt-in/US-opt-out config. E2E with Playwright GPC context.

**Phase 7 — Bridge**
> Read spec §8 (BR-1..4). Implement @libreconsent/bridge: read-only __tcfapi listener with data-driven purpose mapping, unified event API, timeout fallback to full mode. E2E against a stubbed __tcfapi fixture. Confirm G-1: bridge must never write or emit.

**Phase 8 — Worker log**
> Read spec §9 (LOG-1..4). Implement the CF Worker + D1 receipts service and the core receiptEndpoint hook. No IP/UA storage — verify in tests. Round-trip + purge E2E (test account).

**Phase 9 — Release**
> Read spec §10 NFR-5..6 and §12. Write package READMEs and the four quickstarts (basic / GTM / AdSense-bridge / US-only), build the demo site, complete TRACEABILITY audit, run npm publish dry-run, tag v1.0.0. Fill final 05_BUILD_REVIEW and 07_KNOWN_GAPS updates.
