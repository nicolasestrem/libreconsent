# 00 — Project Intake

**Project:** libreconsent (name settled 2026-07-26 — DECISION_LOG D-001)
**Date:** 2026-07-26
**Motivation:** Most "free" CMPs are freemium products shaped by certification economics. This project provides a consent management solution that is free and open source, with first-class Google Consent Mode v2 support.

## Requirements summary

1. Build a **free, open-source consent management solution** — no paid tiers or recurring fees.
2. **Compatibility with Google services**, scoped to: Google Analytics 4, Google Ads tags, and GTM via **Google Consent Mode v2**.
3. Support **multi-domain deployments where AdSense is served on some domains** and audiences vary per domain: some domains have EEA/UK/CH visitors, others do not.
4. Regulatory baseline is **EEA-wide GDPR/ePrivacy**; member-state-specific guidance (e.g., CNIL) is treated as good practice rather than a requirement (see 01_PROJECT_CONTEXT §3).
5. Development mode: **specs-first**. The specification pack is authored before implementation; the build is executed phase-by-phase per 04_CLAUDE_CODE_BUILD_PROMPT.md.

## Constraints

- **C-1:** €0 recurring cost across the entire portfolio. This excludes IAB TCF registration (~€1,350–1,500/yr) and therefore excludes building a certified CMP.
- **C-2:** Open source, freely forkable. This structurally excludes TCF certification (CMP-ID liability model).
- **C-3:** Must not endanger AdSense revenue on EEA/UK/CH-audience domains → those domains use Google's own free certified CMP ("Privacy & messaging"); libreconsent takes a bridge role there.
- **C-4:** One integration API across all domains regardless of which banner runs (bridge mode).
- **C-5:** Zero third-party runtime dependencies; first-party package peers are
  allowed where the public API requires them; self-hostable; no telemetry.

## Success criteria

- **S-1:** A site using libreconsent fires **zero** Google collect requests before consent (E2E-proven).
- **S-2:** Consent Mode v2 defaults are set before any Google tag on every configured page load.
- **S-3:** WCAG 2.1 AA banner/modal; Reject-all as easy as Accept-all.
- **S-4:** GPC honored automatically on US-audience domains.
- **S-5:** Same `getConsent()`/events API works on a domain running Google Privacy & messaging (bridge).
- **S-6:** v1.0.0 published to npm under an OSI license, with quickstarts for: basic site, GTM site, AdSense-EEA (bridge) site, US-only site.

## Explicit exclusions (intake-level)

No TCF (permanent, by design). No paid/hosted service. libreconsent is never the ad-consent banner for EEA/UK/CH AdSense traffic. Jurisdictions beyond GDPR/ePrivacy + US states: out of scope for v1.

## Document map

| File | Purpose |
|---|---|
| 01_PROJECT_CONTEXT.md | Regulatory & Google landscape, per-domain strategy, prior art |
| 02_STRATEGIC_PLAN.md | Scope, roadmap, phases, risks |
| 03_MASTER_PRODUCTION_SPEC.md | Full buildable technical specification (requirement IDs) |
| 04_CLAUDE_CODE_BUILD_PROMPT.md | Execution protocol, CLAUDE.md, per-phase prompts |
| 05_BUILD_REVIEW.md | Review checklist/template, filled after each phase |
| 06_PATCH_PLAN.md | Patch tracking arising from reviews |
| 07_KNOWN_GAPS.md | Accepted limitations & open technical risks |
| 08_CHANGELOG_AI.md | AI-maintained change log for the spec pack |
| DECISION_LOG.md | Numbered decisions with rationale and status |
