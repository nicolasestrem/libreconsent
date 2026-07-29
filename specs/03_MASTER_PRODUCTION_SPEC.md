# 03 — Master Production Spec

The buildable specification. Every requirement has an ID; every ID must map to ≥1 passing test in `specs/TRACEABILITY.md` (§11.5). Global guardrails G-1..G-6 are defined in §13 and constrain every requirement below.

## 1. Repository layout & tooling

```
libreconsent/
├── AGENTS.md               # contributor and agent instructions
├── RELEASING.md            # maintainer release procedure
├── specs/                  # this specification + TRACEABILITY.md + NO_TCF.md
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
- **TOOL-4:** GitHub Actions: immutable-action and credential-persistence guardrails → typecheck → lint → unit → build → size → E2E → a11y; all required.
- **TOOL-5:** TSDoc on all exports; per-package README with copy-paste quickstart.

## 2. Configuration schema (`CmpConfig`)

Validated at `init()`; invalid config throws synchronously with the offending path (CFG-6).

- **CFG-1 Categories:** ordered `{ id, label, description, readonly?, enabled?, services? }`; a `necessary` category with `readonly: true, enabled: true` always exists and is first (injected or reordered as needed). Readonly categories default enabled; non-readonly categories default disabled and reject configured `enabled: true`. *(labels/descriptions are i18n keys.)*
- **CFG-2 Services:** nested per category `{ id, label, cookies?: CookieTableRow[], onlyRegions?: string[] }`; service IDs are globally unique because persisted service choices use one flat record. `CookieTableRow` is `{ name, purpose, provider?, duration?, type? }`; prose fields are i18n keys. Region codes normalize to uppercase.
- **CFG-3 Consent Mode:** `consentMode: { enabled, mapping: Record<GoogleSignal, categoryId | { mode: 'fixed', value: 'denied' }>, defaults: 'denied-everywhere' | { deniedRegions: string[] }, waitForUpdate?: number = 500, adsDataRedaction?: boolean, urlPassthrough?: boolean }`. A string maps its signal to an existing category. The only object form is the exact fixed-denied object (no extra, inherited, missing, or alternate fields); it names no category and is denied in every state. Default mapping: `analytics_storage → analytics`; `ad_storage, ad_user_data, ad_personalization → marketing`.
- **CFG-4 Storage:** `{ cookieName = 'libreconsent', domain?, expiresDays = 365 (max 395), sameSite = 'Lax' }`.
- **CFG-5 Revision:** integer `revision = 1`; stored consent with lower revision → re-prompt (CORE-11).
- **CFG-6 Validation:** synchronous, typed `ConsentError` with stable code and exact paths such as `categories[1].id`; never silent. Selection validation uses the same typed error with selection paths.
- **CFG-7 i18n:** `{ default = 'en', autoDetect = false, translations: Record<locale, Dictionary> }`; EN built-in, FR shipped as second reference dictionary. All category/service/cookie translation keys referenced by the configuration must exist in the effective default dictionary; secondary locales may be partial and fall back to it.
- **CFG-8 US module:** `usPrivacy: { enabled, regions?: string[], doNotSellSelector?: string, respectGPC = true }`. `regions` defaults to `["US"]` and matches prefix-aware on the `-` separator, so `US` covers `US-CA`; a supplied empty array is rejected rather than silently disabling the module (D-045).
- **CFG-9 Region resolution:** pluggable `resolveRegion?: () => Promise<string|null>`; initialization awaits it before `ready`, uppercases a returned code, and treats rejection or `null` as unresolved. No built-in geo-IP (document a same-origin Cloudflare endpoint that reads `request.cf.country` / `CF-IPCountry`). Unresolved region → strictest configured behavior: region-restricted services stay denied.

## 3. CORE — state, storage, lifecycle (`@libreconsent/core`)

- **CORE-1:** `init(config)` is callable pre-DOM-ready. Repeated calls with the same normalized configuration return the singleton API; a material mismatch, including different `resolveRegion` function identity, throws synchronously.
- **CORE-2:** Package-root API: `init(config: CmpConfig): ConsentApi`; `getConsent()`, `acceptAll()`, `rejectAll()`, `setConsent({ categories?, services? })`, `withdraw()`, DOM-safe Phase 1 intents `showPreferences()` / `hide()`, `on/off(event, cb)`, `getConfig()`, and `reset()` (destructive test hook). Decision methods return `void`; decisions called before asynchronous initialization completes are queued and applied in order. `getConfig()` returns a deeply frozen normalized configuration.
- **CORE-3:** Events: replayable `ready`, replayable `consent` (the first *active* state — a restored decision, a state implied by the US opt-out model per US-3, or the first active user decision), and non-replayable `change`. `on()` returns an unsubscribe function. Initialization emits `ready` before restored `consent`; subsequent decisions and withdrawal emit `change`. The `ready` payload contains `{ reason: 'new'|'restored'|'expired'|'revision', consent }` and optional sanitized revision `prefill`; prefill is never active consent.
- **CORE-4:** State: `{ consentId: UUIDv4 (native `crypto.randomUUID`, secure `getRandomValues` v4 fallback), createdAt, updatedAt, revision, categories: Record<id, boolean>, services: Record<id, boolean>, region?, gpcApplied? }`; timestamps are ISO-8601 UTC. Normal changes and withdrawal preserve `consentId` and `createdAt`.
- **CORE-5:** Encoded cookie is source of truth (`Path=/`, `Secure` only on HTTPS, configurable Domain/SameSite/expiry); localStorage is a mirror/fallback. A valid cookie wins; a valid mirror may recover an absent, inaccessible, or corrupt cookie. Invalid/unavailable storage never crashes. Reconciliation writes are allowed only after a valid prior decision is found.
- **CORE-6:** `necessary` always true; no API or UI path can toggle it.
- **CORE-7:** Category changes in `setConsent()` apply first, explicit service changes override them, then categories are recomputed. A non-readonly optional category with services is true iff ≥1 applicable service is accepted; a category toggle sets all applicable services. Readonly values retain their configured value and region-inapplicable services remain denied.
- **CORE-8 (G-4):** Nothing persisted before a user decision — no cookie, no LS key, no "banner shown" flag.
- **CORE-9:** Decisions older than `expiresDays`, measured from `updatedAt`, become inactive → "no decision", re-prompt. A renewed decision receives a new UUID.
- **CORE-10:** Withdrawal ≤2 clicks from persistent entry point; the core immediately persists an all-denied optional state, retains consent ID / creation time, and emits `change` (Consent Mode update arrives in Phase 2).
- **CORE-11:** Lower-revision decisions become inactive and trigger re-prompt; sanitized known choices are exposed only through `ready.prefill`, never through `getConsent()` or a `consent` event. A renewed decision receives a new UUID.

## 4. CM — Google Consent Mode v2 (`@libreconsent/core`)

- **CM-1:** Documented **head snippet** (≤1.5 KB inline) ensures `dataLayer` + `gtag` stub exist and calls `gtag('consent','default', …)` **synchronously before any Google tag**, per CFG-3: all four v2 signals + `wait_for_update`, with `region` arrays for the `deniedRegions` strategy. Its global regional default grants only string-mapped signals; fixed-denied signals remain denied everywhere. It validates the same mapping shape as runtime initialization and fails closed on malformed standalone configuration.
- **CM-2:** On `consent`/`change`/GPC application: `gtag('consent','update', …)` per mapping. Fixed-denied signals always update as `denied`, including accept, reject, withdrawal, restore, revision recovery, and reinitialization.
- **CM-3:** `ads_data_redaction = true` while `ad_storage` denied (when configured); `url_passthrough` per config.
- **CM-4:** Both deployment models are documented in Phase 2: **basic** (Google tags are gated via BLK, implemented in Phase 3) and **advanced** (gtag loads immediately, cookieless pings). Default docs stance: basic. Phase 2 does not claim to provide the basic-mode gate or its network-silence guarantee.
- **CM-5:** GTM: document Consent Initialization trigger; `examples/gtm-site` proves defaults precede GTM consent-init. (Official GTM Community Template: post-v1.)
- **CM-6 (research-at-implementation):** verify signal names/behavior against https://developers.google.com/tag-platform/security/guides/consent; record doc version in PR. Rechecked 2026-07-29 against the guide updated 2026-05-06: defaults precede measurement commands, later choices use updates, regional defaults are supported, and v2 includes all four shipped signals.

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
- **UI-5:** Persistent re-entry: floating settings button (config-removable, positionable to either bottom corner, reflecting the active consent state in its accessible name) and `data-cmp-open` binding / `showPreferences()`.
- **UI-6:** Shadow DOM container by default (light-DOM fallback option) so site CSS can't break equal prominence.
- **UI-7:** No dark patterns: in opt-in flows no pre-checked optional categories, no degraded reject styling in shipped themes, re-prompt only on expiry/revision. The pre-checked rule is specific to opt-in: where the US opt-out model applies (US-3) the visitor is consenting until they opt out, so the preferences layer must show that state truthfully.
- **UI-8:** i18n dictionary-driven; `lang` attribute set; logical CSS properties for structural RTL readiness.

## 7. US — US state privacy (`@libreconsent/core` + UI hooks)

- **US-1:** With `respectGPC` and `navigator.globalPrivacyControl === true`: auto-apply opt-out of sale/share for configured US regions — deny at minimum `ad_storage`/`ad_user_data`/`ad_personalization`, set `gpcApplied: true`, fire events. No banner shown for this. Fixed-denied mappings already remain denied and are neither treated as category IDs nor used to fabricate categories. The signal is re-read on every page load and the resulting state is never persisted; an active stored decision takes precedence over it (D-044).
- **US-2:** "Do Not Sell/Share" link component via `doNotSellSelector`; opens minimal opt-out dialog (not the EU banner); persists like any consent state.
- **US-3:** US regions are opt-out (no blocking wall); EU opt-in and US opt-out must coexist in one config (CFG-9 resolution). An undecided visitor in a configured US region receives an in-memory *implied grant* — optional categories behave as granted so gated tags run and Consent Mode is signaled — which is never persisted (CORE-8) and is replaced by any explicit decision (D-043).
- **US-4 (research-at-implementation):** Google restricted-data-processing integration per current docs; findings → `specs/US_NOTES.md`. The original start URL (`support.google.com/adsense/answer/9561024`) returned HTTP 404 on 2026-07-27; the current guidance is at `support.google.com/google-ads/answer/9614122` (advertisers) and `support.google.com/admanager/answer/9561023` (publishers), both recorded in US_NOTES with retrieval dates.

## 8. BR — bridge mode (`@libreconsent/bridge`)

- **BR-1:** `initBridge(config)`: UI-less, read-only — never renders, never writes consent storage, never emits consent signals.
- **BR-2:** Detects `window.__tcfapi` (poll with backoff, configurable timeout), subscribes via `addEventListener`, and treats only a `success === true` listener callback received before the absolute deadline as successful registration (D-050); derives category booleans from TCF purposes via **configurable mapping shipped as data** with documented defaults.
- **BR-3:** Exposes the same `ready`/`consent`/`change` + `getConsent()` API as core.
- **BR-4:** No successfully registered external CMP before the absolute timeout → `ready` with `source: 'none'`; configurable fallback to full libreconsent behavior (covers mixed-audience domains with one snippet).

## 9. LOG — consent receipts (`@libreconsent/worker-log`, optional)

- **LOG-1:** Cloudflare Worker + D1; `wrangler deploy` with one-page setup. Core fully functional without it.
- **LOG-2:** `POST /receipt` `{ consentId, host, revision, categories, ts, action: 'consent'|'change'|'withdraw' }`. **No IP, no UA, no fingerprint stored.** Origin allowlist + rate limiting.
- **LOG-3:** `GET /receipts/:consentId` (bearer-protected) returns audit trail; configurable retention + scheduled purge.
- **LOG-4:** Core: `receiptEndpoint?: string`; fire-and-forget `fetch keepalive`; failures never affect UX.

## 10. Non-functional requirements

- **NFR-1 Size (CI hard-fail):** core ≤ 12 KB min+gz; core+ui IIFE ≤ 19 KB; bridge ≤ 4 KB; head snippet ≤ 1.5 KB. The first two figures were re-baselined once, after Phase 5, from measurement rather than estimate (D-042); the original 8 KB / 15 KB were set at Phase 0 before any code existed. Raising a budget again requires the same evidence and a new DECISION_LOG entry — G-3 stays a hard CI failure.
- **NFR-2 Performance:** no CLS from banner injection (reserved positioning documented); zero library-originated network (except LOG-4 opt-in).
- **NFR-3 Library privacy:** no telemetry/phone-home/CDN requirement; no third-party runtime dependencies; the UI may require a compatible core through package peer metadata; self-host first.
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
| 0 | Monorepo builds; CI green incl. size on stubs; AGENTS.md + specs/ committed |
| 1 | Unit suite green; traceability rows for all CFG/CORE |
| 2 | Head snippet documented; E2E asserts `default` precedes gtag |
| 3 | Flagship 11.2 green with real gtag.js |
| 4 | axe-core green; keyboard E2E green; equal-prominence visual check |
| 5 | BLK-4 E2E; budgets met with real code; CSP fixture green |
| 6 | GPC E2E green; US_NOTES.md written from live Google docs |
| 7 | Bridge E2E green; fallback (BR-4) tested |
| 8 | Receipt round-trip E2E on a test CF account; purge tested |
| 9 | READMEs + 4 quickstarts + demo site; each quickstart runs with tracked relative browser artifacts on an ordinary static server; `v1.0.0` tagged; npm publish dry-run clean |

## 13. Global guardrails

Project-wide invariants. They outrank convenience, and a change to any of them
is a spec change, not an implementation detail. Contributions that cross one of
these lines are rejected on that ground alone.

- **G-1 — No TCF.** Never emit a TC string, never provide `__tcfapi`, never
  claim a CMP ID. Read-only `__tcfapi` *consumption* in `packages/bridge` is the
  sole exception. Rationale: `specs/NO_TCF.md` and the certification economics in
  01 §1.
- **G-2 — Zero third-party runtime dependencies** in `core`, `ui` and `bridge`.
  `@libreconsent/ui` requiring a compatible `@libreconsent/core` through peer
  metadata is the only permitted package relationship (D-059).
- **G-3 — Size budgets (NFR-1) are hard CI failures**, not advisory targets.
  Raising one requires measurement and a DECISION_LOG entry.
- **G-4 — Nothing is stored client-side before a user decision** (CORE-8). No
  cookie, no `localStorage` key, no fingerprint.
- **G-5 — Every user-facing string comes from the i18n layer** (CFG-7). No
  hard-coded prose in rendering code.
- **G-6 — No `eval`, `new Function`, or `innerHTML` fed with configuration
  strings.** Consent surfaces are built with DOM APIs (NFR-4).
