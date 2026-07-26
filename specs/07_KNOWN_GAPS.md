# 07 — Known Gaps

Accepted limitations and open technical risks, documented up front. IDs are `KG-*` (distinct from guardrails `G-*` in 04). Each gap has a stance: `accepted` (by design), `mitigated` (partially addressed), or `watch` (may need future work).

| ID | Gap | Stance | Detail / Mitigation |
|----|-----|--------|---------------------|
| KG-1 | **Dynamic script interception (BLK-4) is best-effort, not guaranteed.** Parser-inserted scripts cannot be reliably neutered post-insertion. | accepted | The guaranteed path is declarative gating (BLK-1). Docs must never oversell BLK-4; flagship E2E covers the guaranteed path. |
| KG-2 | **No TCF support — libreconsent can never be the ad-consent banner for EEA/UK/CH AdSense traffic.** | accepted | By design (guardrail G-1 in 04; economics in 01 §1). Covered portfolio-wide by Google Privacy & messaging + bridge mode. |
| KG-3 | **Withdrawal cannot un-execute already-run scripts** (BLK-5). | accepted | Immediate signal/storage update + documented `reloadOnWithdraw` option. Industry-standard limitation. |
| KG-4 | **No built-in geolocation** (CFG-9). Region-dependent behavior needs site-supplied geo. | mitigated | Documented Cloudflare `CF-IPCountry` pattern; strictest-behavior fallback when unresolved. |
| KG-5 | **Non-Google tags (e.g., Meta Pixel) on EEA-audience AdSense domains are not covered by Google's banner**, and libreconsent deliberately isn't the banner there. | watch | If those domains need non-Google marketing tags, options: run them gated on the bridge-derived TCF purposes (legal review needed) or move that domain to a certified third-party CMP. Revisit if the need materializes. |
| KG-6 | **Google Consent Mode / RDP details drift.** Spec snapshots may be stale at build time. | mitigated | CM-6 / US-4 research-at-implementation protocol: fetch live docs, cite in PR. |
| KG-7 | **Advanced consent mode sends cookieless pings pre-consent** — some EU DPAs view even that skeptically. | accepted | Default docs stance is basic mode (CM-4); advanced is opt-in with the trade-off documented. |
| KG-8 | **US state privacy laws are a moving target** (new states, evolving GPC enforcement). | watch | Opt-out architecture (US-3) generalizes; region list is config, not code. |
| KG-9 | **Consent receipts (worker-log) prove a record exists, not that the UI was compliant at that moment.** | accepted | Receipt includes `revision`; pairing revision → git tag of shipped UI gives reasonable evidence. Documented. |
| KG-10 | **No legal review of shipped default texts.** EN/FR dictionary defaults are engineering-written. | watch | README disclaimer: site owners are responsible for their notice texts; defaults are a starting point, not legal advice. |
| KG-11 | **Pre-decision zero-storage (CORE-8) means a user who ignores the banner re-sees it every page load.** The consent cookie itself is strictly-necessary-exempt, but only exists *after* a decision. | accepted | Correct behavior under ePrivacy; documented so it isn't "fixed" as a bug. |
| KG-12 | **Safari ITP caps script-written cookie lifetime (~7 days in some contexts)**, potentially shortening effective consent persistence vs `expiresDays`. | watch | Acceptable at launch (re-prompt is lawful); document; server-set cookie via worker-log is a possible future mitigation. |
