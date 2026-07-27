# 03 — Master Production Spec

The buildable specification. Every requirement has an ID; every ID must map to ≥1 passing test in `specs/TRACEABILITY.md` (§11.5). Global guardrails G-1..G-6 are defined in 04_CLAUDE_CODE_BUILD_PROMPT.md and are part of this spec.

## 1. Repository layout & tooling

```
libreconsent/
├── CLAUDE.md
├── specs/                  # this pack, copied into the repo + TRACEABILITY.md + NO_TCF.md
├── packages/
│   ├── core/               # @libreconsent/core — state, storage, consent mode, blocking
│   ├── ui/                 # @libreconsent/ui — banner + preferences modal
│   ├── bridge/             # @libreconsent/bridge — listen-only mode for external CMPs
│   └── worker-log/         # @libreconsent/worker-log — optional CF Worker + D1 receipts
├── examples/
│   ├── basic-site/         # static fixture used by E2E
│   ├── gtm-site/           # GTM fixture
│   └── us-only-site/       # GPC / opt-out fixture
└── .github/workflows/ci.yml
```

- **TOOL-1:** pnpm workspaces monorepo; Node LTS.
- **TOOL-2:** TypeScript strict; `tsup` builds ESM + minified IIFE; target ES2020.
- **TOOL-3:** Vitest (+ jsdom) unit; Playwright E2E against `examples/*`; `size-limit`; Biome (or ESLint+Prettier).
- **TOOL-4:** GitHub Actions: typecheck → lint → unit → build → size → E2E → a11y; all required.
- **TOOL-5:** TSDoc on all exports; per-package README with copy-paste quickstart.

## 2. Configuration schema (`CmpConfig`)

Validated at `init()`; invalid config throws synchronously with the offending path (CFG-6).

- **CFG-1 Categories:** ordered `{ id, label, description, readonly?, enabled?, services? }`; a `necessary` category with `readonly: true, enabled: true` always exists and is first (injected or reordered as needed). Readonly categories default enabled; non-readonly categories default disabled and reject configured `enabled: true`. *(labels/descriptions are i18n keys.)*
- **CFG-2 Services:** nested per category `{ id, label, cookies?: CookieTableRow[], onlyRegions?: string[] }`; service IDs are globally unique because persisted service choices use one flat record. `CookieTableRow` is `{ name, purpose, provider?, duration?, type? }`; prose fields are i18n keys. Region codes normalize to uppercase.
- **CFG-3 Consent Mode:** `consentMode: { enabled, mapping: Record<GoogleSignal, categoryId>, defaults: 'denied-everywhere' | { deniedRegions: string[] }, waitForUpdate?: number = 500, adsDataRedaction?: boolean, urlPassthrough?: boolean }`. Default mapping: `analytics_storage → analytics`; `ad_storage, ad_user_data, ad_personalization → marketing`.
- **CFG-4 Storage:** `{ cookieName = 'libreconsent', domain?, expiresDays = 365 (max 395), sameSite = 'Lax' }`.
- **CFG-5 Revision:** integer `revision = 1`; stored consent with lower revision → re-prompt (CORE-11).
- **CFG-6 Validation:** synchronous, typed `ConsentError` with stable code and exact paths such as `categories[1].id`; never silent. Selection validation uses the same typed error with selection paths.
- **CFG-7 i18n:** `{ default = 'en', autoDetect = false, translations: Record<locale, Dictionary> }`; EN built-in, FR shipped as second reference dictionary. All category/service/cookie translation keys referenced by the configuration must exist in the effective default dictionary; secondary locales may be partial and fall back to it.
- **CFG-8 US module:** `usPrivacy: { enabled, regions?: string[], doNotSellSelector?: string, respectGPC = true }`.
- **CFG-9 Region resolution:** pluggable `resolveRegion?: () => Promise<string|null>`; initialization awaits it before `ready`, uppercases a returned code, and treats rejection or `null` as unresolved. No built-in geo-IP (document a same-origin Cloudflare endpoint that reads `request.cf.country` / `CF-IPCountry`). Unresolved region → strictest configured behavior: region-restricted services stay denied.

## 3. CORE — state, storage, lifecycle (`@libreconsent/core`)

- **CORE-1:** `init(config)` is callable pre-DOM-ready. Repeated calls with the same normalized configuration return the singleton API; a material mismatch, including different `resolveRegion` function identity, throws synchronously.
- **CORE-2:** Package-root API: `init(config: CmpConfig): ConsentApi`; `getConsent()`, `acceptAll()`, `rejectAll()`, `setConsent({ categories?, services? })`, `withdraw()`, DOM-safe Phase 1 intents `showPreferences()` / `hide()`, `on/off(event, cb)`, `getConfig()`, and `reset()` (destructive test hook). Decision methods return `void`; decisions called before asynchronous initialization completes are queued and applied in order. `getConfig()` returns a deeply frozen normalized configuration.
- **CORE-3:** Events: replayable `ready`, replayable `consent` (restored state or first active user decision), and non-replayable `change`. `on()` returns an unsubscribe function. Initialization emits `ready` before restored `consent`; subsequent decisions and withdrawal emit `change`. The `ready` payload contains `{ reason: 'new'|'restored'|'expired'|'revision', consent }` and optional sanitized revision `prefill`; prefill is never active consent.
- **CORE-4:** State: `{ consentId: UUIDv4 (native `crypto.randomUUID`, secure `getRandomValues` v4 fallback), createdAt, updatedAt, revision, categories: Record<id, boolean>, services: Record<id, boolean>, region?, gpcApplied? }`; timestamps are ISO-8601 UTC. Normal changes and withdrawal preserve `consentId` and `createdAt`.
- **CORE-5:** Encoded cookie is source of truth (`Path=/`, `Secure` only on HTTPS, configurable Domain/SameSite/expiry); localStorage is a mirror/fallback. A valid cookie wins; a valid mirror may recover an absent, inaccessible, or corrupt cookie. Invalid/unavailable storage never crashes. Reconciliation writes are allowed only after a valid prior decision is found.
- **CORE-6:** `necessary` always true; no API or UI path can toggle it.
- **CORE-7:** Category changes in `setConsent()` apply first, explicit service changes override them, then categories are recomputed. A non-readonly optional category with services is true iff ≥1 applicable service is accepted; a category toggle sets all applicable services. Readonly values retain their configured value and region-inapplicable services remain denied.
- **CORE-8 (G-4):** Nothing persisted before a user decision — no cookie, no LS key, no "banner shown" flag.
- **CORE-9:** Decisions older than `expiresDays`, measured from `updatedAt`, become inactive → "no decision", re-prompt. A renewed decision receives a new UUID.
- **CORE-10:** Withdrawal ≤2 clicks from persistent entry point; the core immediately persists an all-denied optional state, retains consent ID / creation time, and emits `change` (Consent Mode update arrives in Phase 2).
- **CORE-11:** Lower-revision decisions become inactive and trigger re-prompt; sanitized known choices are exposed only through `ready.prefill`, never through `getConsent()` or a `consent` event. A renewed decision receives a new UUID.

## 4. CM — Google Consent Mode v2 (`@libreconsent/core`)

- **CM-1:** Documented **head snippet** (≤1.5 KB inline) ensures `dataLayer` + `gtag` stub exist and calls `gtag('consent','default', …)` **synchronously before any Google tag**, per CFG-3: all four v2 signals + `wait_for_update`, with `region` arrays for the `deniedRegions` strategy.
- **CM-2:** On `consent`/`change`/GPC application: `gtag('consent','update', …)` per mapping.
- **CM-3:** `ads_data_redaction = true` while `ad_storage` denied (when configured); `url_passthrough` per config.
- **CM-4:** Both deployment models are documented in Phase 2: **basic** (Google tags are gated via BLK, implemented in Phase 3) and **advanced** (gtag loads immediately, cookieless pings). Default docs stance: basic. Phase 2 does not claim to provide the basic-mode gate or its network-silence guarantee.
- **CM-5:** GTM: document Consent Initialization trigger; `examples/gtm-site` proves defaults precede GTM consent-init. (Official GTM Community Template: post-v1.)
- **CM-6 (research-at-implementation):** verify signal names/behavior against https://developers.google.com/tag-platform/security/guides/consent; record doc version in PR.

## 5. BLK — script & embed blocking (`@libreconsent/core`)

- **BLK-1 (guaranteed path):** `<script type="text/plain" data-cmp-category="…" [data-cmp-service="…"]>` (src or inline). On consent: re-created with correct type, executed **in document order**, attributes preserved, async/defer semantics preserved.
- **BLK-2:** CSP: re-created scripts propagate `nonce` (from config or original element); CSP-enabled fixture in E2E.
- **BLK-3:** Embeds: `<iframe data-cmp-src data-cmp-category="…">` + generic `data-cmp-placeholder` render an i18n placeholder with inline accept; `src` set only on consent. YouTube + Google Maps recipes documented.
- **BLK-4 (best-effort net):** MutationObserver neuters dynamically injected `<script>` nodes matching configured blocklist patterns pre-consent, where timing allows. **Not a guarantee** — parser-inserted scripts can't be reliably intercepted; docs must say the guaranteed path is BLK-1. Test asserts interception of dynamically-appended matching scripts.
- **BLK-5:** Withdrawal can't un-execute scripts: state/signals update immediately; `reloadOnWithdraw?: boolean = false` documented.

## 6. UI — banner & preferences (`@libreconsent/ui`)

- **UI-1:** First layer: title, short text, **Accept all / Reject all equal prominence**, Customize. Layouts: `bar-bottom` (default), `box`, `modal`.
- **UI-2:** Second layer: per-category sections, per-service toggles, cookie tables, Save / Accept all / Reject all.
- **UI-3:** WCAG 2.1 AA: `role="dialog"`, `aria-modal`, labelled controls, focus trap, ESC, focus restore, full keyboard operability, visible focus, `prefers-reduced-motion`. axe-core in CI + manual checklist in `specs/`.
- **UI-4:** Theming via CSS custom properties (`--libreconsent-*`) only; dark mode via `prefers-color-scheme` + manual override; **zero external assets/network**.
- **UI-5:** Persistent re-entry: floating settings button (config-removable) and `data-cmp-open` binding / `showPreferences()`.
- **UI-6:** Shadow DOM container by default (light-DOM fallback option) so site CSS can't break equal prominence.
- **UI-7:** No dark patterns: no pre-checked optional categories, no degraded reject styling in shipped themes, re-prompt only on expiry/revision.
- **UI-8:** i18n dictionary-driven; `lang` attribute set; logical CSS properties for structural RTL readiness.

## 7. US — US state privacy (`@libreconsent/core` + UI hooks)

- **US-1:** With `respectGPC` and `navigator.globalPrivacyControl === true`: auto-apply opt-out of sale/share for configured US regions — deny at minimum `ad_storage`/`ad_user_data`/`ad_personalization`, set `gpcApplied: true`, fire events. No banner shown for this.
- **US-2:** "Do Not Sell/Share" link component via `doNotSellSelector`; opens minimal opt-out dialog (not the EU banner); persists like any consent state.
- **US-3:** US regions are opt-out (no blocking wall); EU opt-in and US opt-out must coexist in one config (CFG-9 resolution).
- **US-4 (research-at-implementation):** Google restricted-data-processing integration per current docs (start: https://support.google.com/adsense/answer/9561024); findings → `specs/US_NOTES.md`.

## 8. BR — bridge mode (`@libreconsent/bridge`)

- **BR-1:** `initBridge(config)`: UI-less, read-only — never renders, never writes consent storage, never emits consent signals.
- **BR-2:** Detects `window.__tcfapi` (poll with backoff, configurable timeout), subscribes via `addEventListener`, derives category booleans from TCF purposes via **configurable mapping shipped as data** with documented defaults.
- **BR-3:** Exposes the same `ready`/`consent`/`change` + `getConsent()` API as core.
- **BR-4:** No external CMP within timeout → `ready` with `source: 'none'`; configurable fallback to full libreconsent behavior (covers mixed-audience domains with one snippet).

## 9. LOG — consent receipts (`@libreconsent/worker-log`, optional)

- **LOG-1:** Cloudflare Worker + D1; `wrangler deploy` with one-page setup. Core fully functional without it.
- **LOG-2:** `POST /receipt` `{ consentId, host, revision, categories, ts, action: 'consent'|'change'|'withdraw' }`. **No IP, no UA, no fingerprint stored.** Origin allowlist + rate limiting.
- **LOG-3:** `GET /receipts/:consentId` (bearer-protected) returns audit trail; configurable retention + scheduled purge.
- **LOG-4:** Core: `receiptEndpoint?: string`; fire-and-forget `fetch keepalive`; failures never affect UX.

## 10. Non-functional requirements

- **NFR-1 Size (CI hard-fail):** core ≤ 12 KB min+gz; core+ui IIFE ≤ 19 KB; bridge ≤ 4 KB; head snippet ≤ 1.5 KB. The first two figures were re-baselined once, after Phase 5, from measurement rather than estimate (D-042); the original 8 KB / 15 KB were set at Phase 0 before any code existed. Raising a budget again requires the same evidence and a new DECISION_LOG entry — G-3 stays a hard CI failure.
- **NFR-2 Performance:** no CLS from banner injection (reserved positioning documented); zero library-originated network (except LOG-4 opt-in).
- **NFR-3 Library privacy:** no telemetry/phone-home/CDN requirement; self-host first.
- **NFR-4 Security:** G-6; BLK-2 CSP; all storage first-party.
- **NFR-5 License:** MIT (DECISION_LOG D-002); SPDX headers; no copyleft encumbrance on build output.
- **NFR-6 API stability:** semver from 1.0; only package-root exports are public.
- **Browsers:** evergreen Chrome/Edge/Firefox (last 2) + Safari 15.4+; no legacy bundles; inline `randomUUID` polyfill is the only permitted shim.

## 11. Test plan

- **11.1 Unit (Vitest/jsdom):** config validation; state transitions; storage round-trip + corruption; expiry/revision; CM mapping; BR purpose-mapping; US GPC logic.
- **11.2 E2E flagship — `pre-consent-network-silence` (Playwright):** on `examples/basic-site` with real `gtag.js` (basic mode): intercept all requests; assert **zero** hits to `google-analytics.com`, `analytics.google.com`, `googletagmanager.com/collect`, `doubleclick.net` pre-consent; `dataLayer` contains consent `default` before any gtag command; post-Accept: collects occur, `update` granted; post-Reject: continued silence (basic) / cookieless-ping shape only (advanced fixture).
- **11.3 E2E behavioral:** BLK-1 order preservation; CSP fixture; BLK-4 dynamic injection; iframe placeholder flow; withdrawal rewrites cookie + fires update; expiry (mocked clock) and revision re-prompts; GPC context (Playwright contextOptions) triggers US-1; stubbed `__tcfapi` bridge fixture; keyboard-only accept AND reject journeys.
- **11.4 A11y:** axe-core on banner + modal in CI; zero critical/serious.
- **11.5 Traceability:** `specs/TRACEABILITY.md` maps every requirement ID → file(s) → test(s); CI script fails on unmapped IDs.

## 12. Phase Definitions of Done

| Phase | DoD |
|---|---|
| 0 | Monorepo builds; CI green incl. size on stubs; CLAUDE.md + specs/ committed |
| 1 | Unit suite green; traceability rows for all CFG/CORE |
| 2 | Head snippet documented; E2E asserts `default` precedes gtag |
| 3 | Flagship 11.2 green with real gtag.js |
| 4 | axe-core green; keyboard E2E green; equal-prominence visual check |
| 5 | BLK-4 E2E; budgets met with real code; CSP fixture green |
| 6 | GPC E2E green; US_NOTES.md written from live Google docs |
| 7 | Bridge E2E green; fallback (BR-4) tested |
| 8 | Receipt round-trip E2E on a test CF account; purge tested |
| 9 | READMEs + 4 quickstarts + demo site; `v1.0.0` tagged; npm publish dry-run clean |
