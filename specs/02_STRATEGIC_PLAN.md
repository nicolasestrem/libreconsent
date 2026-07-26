# 02 — Strategic Plan

## 1. Product definition

A free, open-source consent management library, **Consent-Mode-v2-native**, for sites using GA4 / Google Ads tags / GTM — plus a US-state privacy module (GPC, opt-out) and a **bridge mode** exposing the same JS API on domains where Google's certified Privacy & messaging banner owns consent (AdSense + EEA/UK/CH audience).

**Non-goals (permanent):** TCF emission of any kind; serving as ad-consent banner for European AdSense traffic; hosted/paid tier; telemetry.

## 2. Workstreams

- **W-0 (operational, outside this repo — for site operators):** configure Privacy & messaging on AdSense domains with EEA/UK/CH audiences — GDPR message, Consent Mode integration enabled, TCF v2.3 mode verified (mandatory since 2026-02-28; misconfiguration silently falls to Limited Ads), geo-target EEA/UK/CH. Protects revenue before any code exists.
- **W-1 (the build):** libreconsent itself, executed by Claude Code per 03/04. Phases below.

## 3. Phase plan (one PR per phase; details & DoD in 03 §9)

| # | Phase | Content | Requirement IDs |
|---|-------|---------|-----------------|
| 0 | Scaffold | Monorepo, CI, budgets-on-stubs, CLAUDE.md, specs/ in repo | TOOL-1..5 |
| 1 | Core | Config, state, storage, expiry, revision | CFG-1..7, CFG-9, CORE-1..11 |
| 2 | Consent Mode v2 | Head snippet, default/update, mappings | CM-1..6 |
| 3 | Blocking | Declarative scripts, CSP, embed placeholders | BLK-1..3, BLK-5 |
| 4 | UI | Banner + modal, a11y, theming, i18n | UI-1..8 |
| 5 | Hardening | Dynamic-injection net, size/security audit | BLK-4, NFR-1..4 |
| 6 | US module | GPC, Do-Not-Sell, RDP research | US-1..4, CFG-8 |
| 7 | Bridge | __tcfapi listener, fallback mode | BR-1..4 |
| 8 | Worker log | CF Worker + D1 receipts (optional pkg) | LOG-1..4 |
| 9 | Release | Docs, quickstarts, demo, v1.0.0 | NFR-5..6 |

Sequencing rationale: value lands earliest at Phase 3+2 (a deployable, provably-silent Consent Mode CMP without UI polish); UI follows; portfolio features (US, bridge) after the core is trustworthy.

## 4. Milestone gates

- **M-A (after Phase 3):** flagship E2E `pre-consent-network-silence` green with real gtag.js → deploy to one non-ad domain as dogfood.
- **M-B (after Phase 5):** size budgets met with real code; security checklist pass → public repo visibility if desired.
- **M-C (after Phase 7):** bridge verified against a real AdSense domain running Privacy & messaging → portfolio-wide rollout.
- **M-D (Phase 9):** npm v1.0.0.

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Tags fire before consent (most common compliance failure) | Dual blocking; flagship E2E as permanent regression gate |
| Google changes Consent Mode | Historically slow (v1 2020 → v2 2024); CM-6 re-verify at build; watch changelog |
| Scope-creep toward TCF from users of the repo | Guardrail G-1 + specs/NO_TCF.md + README statement |
| Mixed-banner UX drift across portfolio | Bridge mode (BR-1..4) gives one API |
| BLK-4 interception is not guaranteed | Documented as best-effort; declarative path is the guarantee (07_KNOWN_GAPS KG-1) |
| Member-state guidance stricter than the EEA baseline | Baseline is EEA-wide (01 §3); national extras tracked as good practice |

## 6. Post-v1 backlog (not planned, recorded)

GTM Community Template publication · WordPress wrapper plugin · additional locales · more embed recipes · consent-analytics mini-dashboard on top of worker-log.
