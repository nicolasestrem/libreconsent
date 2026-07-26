# 01 — Project Context

Research snapshot 2026-07-26. Sources listed in §6. Anything marked *(verify at build time)* must be re-checked against live docs during implementation.

## 1. Market context: CMP certification economics

The commercial CMP market is shaped by one requirement: publishers serving **Google ads (AdSense/Ad Manager/AdMob) to users in the EEA, UK, or Switzerland** must use a **Google-certified CMP integrated with IAB TCF** (EEA/UK since 2024-01-16; CH since 2024-07-31). Certification economics:

- IAB Europe TCF CMP registration: **~€1,350–1,500/year**, annual renewal.
- Google certification on top: intake process + **mandatory recertification every 12 months**.
- **TCF v2.3** (released 2025-06-19) enforced by Google since **2026-02-28**: TC strings without the `disclosedVendors` segment are invalid → ads degrade to Limited Ads (50%+ revenue impact typical).
- The TC string embeds a **CMP ID validated against the paid registry** — it cannot be self-issued or spoofed.
- IAB holds the CMP-ID owner responsible for every deployment's behavior → structurally incompatible with freely forkable open source, which is why no open-source CMP holds certification.

## 2. Certified consent on AdSense domains, at zero cost

Google ships its **own free, certified CMP** inside AdSense/Ad Manager/AdMob: **Privacy & messaging** (European regulations messages). Verified: TCF v2.3-ready, free, geo-targetable to EEA/UK/CH, and able to drive **Consent Mode** signals including `analytics_storage` when enabled in message settings. On EEA-audience AdSense domains it can be the **single** banner covering both ads and GA4.

## 3. Regulatory footing

- **GDPR + ePrivacy apply to visitors from any EEA country**, so the baseline below is EEA-wide. Member-state regulators (e.g., France's CNIL) publish stricter guidance; those extras are treated as good practice, not requirements. Google's certified-CMP rule is contractual and regulator-independent.
- EU baseline for libreconsent: prior blocking, granular categories, equal-prominence Reject-all, easy withdrawal, consent records, expiry ≤ ~13 months, no dark patterns.
- US baseline: opt-out model, **GPC signal**, "Do Not Sell/Share" link; Google-side restricted data processing *(verify at build time)*.

## 4. Per-domain strategy (the core architectural insight)

| Domain type | Ad consent | Analytics/tags consent | libreconsent role | Cost |
|---|---|---|---|---|
| AdSense + EEA/UK/CH audience | Google Privacy & messaging (certified, free) | Same Google banner (Consent Mode option on) | **bridge** (read-only, same JS API) | €0 |
| AdSense, non-EU audience | None required | libreconsent | **full** + US module | €0 |
| No ads | — | libreconsent | **full** | €0 |

Rules: one banner per domain, never two. Geo-splitting on mixed domains is done by Google's message geo-targeting, not rebuilt. Non-Google tags (e.g., Meta Pixel) on EEA ad domains are NOT covered by Google's banner — currently flagged as a known gap (07_KNOWN_GAPS KG-5).

## 5. Prior art

- **orestbida/cookieconsent** (MIT) — closest existing project; its maintainer's TCF discussion is the reference explanation of FOSS-vs-TCF.
- **Klaro** (BSD) — config-driven service toggles.
- **tarteaucitron.js** (MIT) — richest library of per-service blocking recipes; mine for BLK-3 patterns.
- **c15t** — headless/React-first consent infra.

Differentiators justifying a fresh build: consent-mode-first design, US-states module, and bridge mode giving one API across a mixed portfolio.

## 6. Sources

- Google consent requirements (publishers): https://support.google.com/adsense/answer/13554116
- Google CMP certification: https://support.google.com/admanager/answer/13554020
- About Privacy & messaging: https://support.google.com/admanager/answer/10075997
- European regulations messages (TCF v2.3): https://support.google.com/admanager/answer/10076805
- IAB Europe TCF for CMPs: https://iabeurope.eu/tcf-for-cmps/
- CMP fee reporting: https://www.adexchanger.com/online-advertising/iab-europe-raises-cmp-fee-and-readies-consent-framework-for-an-update/
- FOSS-vs-TCF discussion: https://github.com/orestbida/cookieconsent/discussions/523
- Consent Mode reference: https://developers.google.com/tag-platform/security/guides/consent
