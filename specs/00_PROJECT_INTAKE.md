# 00 — Project Intake

**Project:** libreconsent (name settled 2026-07-26 — DECISION_LOG D-001)
**Date:** 2026-07-26
**Motivation:** Most "free" CMPs are freemium products shaped by certification economics. This project provides a consent management solution that is free and open source, with first-class Google Consent Mode v2 support.

## Requirements summary

1. Build a **free, open-source consent management solution** — no paid tiers or recurring fees.
2. **Compatibility with Google services**, scoped to: Google Analytics 4, Google Ads tags, and GTM via **Google Consent Mode v2**.
3. Support **multi-domain deployments where AdSense is served on some domains** and audiences vary per domain: some domains have EEA/UK/CH visitors, others do not.
4. Regulatory baseline is **EEA-wide GDPR/ePrivacy**; member-state-specific guidance (e.g., CNIL) is treated as good practice rather than a requirement (see 01_PROJECT_CONTEXT §3).
5. Development mode: **specs-first**. The specification is authored before implementation, and the build is executed one phase at a time against the definitions of done in 03_MASTER_PRODUCTION_SPEC.md §12.

## Constraints

- **C-1:** €0 recurring cost for an operator running libreconsent, on any number of sites. This excludes IAB TCF registration (~€1,350–1,500/yr) and therefore excludes building a certified CMP.
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
| 03_MASTER_PRODUCTION_SPEC.md | Full buildable technical specification (requirement IDs, global guardrails) |
| 07_KNOWN_GAPS.md | Accepted limitations & open technical risks |
| A11Y_CHECKLIST.md | Manual accessibility checks that automated scanning cannot judge |
| DECISION_LOG.md | Numbered decisions with rationale and status |
| NO_TCF.md | Why TCF is permanently out of scope, and what the bridge does instead |
| SECURITY_CHECKLIST.md | Manual security and privacy checks |
| TRACEABILITY.md | Requirement ID → implementation → test mapping, enforced in CI |
| US_NOTES.md | US state privacy research record behind the US module |
