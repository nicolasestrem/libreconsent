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
- **Scope:** D-019 records the CM-4 phase boundary: both deployment models and their tradeoffs are documented in Phase 2, while basic mode's declarative BLK gate and real pre-consent network-silence guarantee remain Phase 3. Basic mode is the recommended deployment; no GTM Community Template is included.
- **Verdict:** pass
- **Findings:** PR #5 review found the unfinished phase record, an unhandled fixture-artifact read, an omitted `enabled` bootstrap value incorrectly failing closed, and ambiguous CM-4 phase wording. The final gate is recorded; missing artifacts return HTTP 500; an omitted `enabled` value is side-effect-free; and D-019 explicitly records the CM-4 Phase 2/Phase 3 boundary (P-011, P-012).

### Phase 3 — Blocking
- **Date / PR:** 2026-07-26 · this PR
- **Scope:** BLK-1, BLK-2, BLK-3, BLK-5. BLK-4's MutationObserver net is deliberately excluded — it belongs to Phase 5 and is documented there as best-effort, never a guarantee.
- **Implementation:** `packages/core/src/blocking.ts` scans the document once with one combined selector (so gate order is document order), owns its own DOM-readiness because the core never waits for the DOM elsewhere, and subscribes to the same replayable `consent` plus `change` pair as the Consent Mode adapter. Gated scripts are replaced in place and executed through a serialized promise chain: non-`async` `src` gates clear the script-inserted async default and are awaited on `load` or `error`; `async` gates are not awaited, preserving their declared semantics; inline gates run synchronously on insertion. Embeds are hidden with both `hidden` and inline `display:none` (the author's inline value is restored on reveal) and get a `createElement`/`textContent` placeholder with `blocked.notice` / `blocked.accept` prose from the new minimal i18n resolver in `packages/core/src/i18n.ts`.
- **Google research (CM-6 hygiene):** the basic-mode gate this phase delivers is Google-specific, so the consulted-documentation record in `packages/core/README.md` was refreshed. Accessed 2026-07-26: [Set up consent mode on websites](https://developers.google.com/tag-platform/security/guides/consent) (updated 2026-05-06), [Google tag API reference](https://developers.google.com/tag-platform/gtagjs/reference) (updated 2026-04-17), [GTM consent-template APIs](https://developers.google.com/tag-platform/tag-manager/templates/consent-apis) (updated 2026-03-05).
- **Verification:** final `pnpm check` passed on 2026-07-27 — traceability through Phase 3 (34 requirements), `tsc --noEmit` clean, Biome clean over 54 files, **132 unit tests** across 8 files (36 new in `packages/core/src/blocking.test.ts`), all package builds, size budgets, **18 E2E tests**, and **5 accessibility tests** with zero serious/critical violations on the two new fixtures.
- **Measured size:** core IIFE **7.25 kB gzip** against the 8 kB limit (5.77 kB in Phase 2, so blocking cost 1.48 kB and 0.75 kB of headroom remains). core+ui 7.56 kB / 15 kB; bridge 318 B / 4 kB; head snippet 714 B / 1.5 kB.
- **Flagship (03 §11.2):** green with real `gtag.js`. The endpoint list is untouched and no assertion was weakened. Pre-consent there are zero hits to the four fixed endpoints and the loader itself is never fetched; the consent `default` is `dataLayer[0]` and precedes every gtag command with no `update` present; after accept the vendored loader executes and a granted collect arrives (observed `gcs=G111&gcu=1`); after reject the silence continues. Per D-025 the loader is a vendored byte-identical copy (provenance in `tests/vendor/README.md`) served by request interception, so CI needs no egress to Google.
- **Assertion-vacuity guard:** interception was verified to observe `navigator.sendBeacon`, which is Analytics' preferred transport, and that verification is now a permanent test rather than a one-off check. The earlier plan to delete `sendBeacon` in the page was dropped as unnecessary unrealism once interception was proven to cover it.
- **Guardrails:** core/ui/bridge still declare zero runtime dependencies; a prohibited-construct scan over shipped sources found no `eval`, `new Function`, config-driven `innerHTML`, `__tcfapi` provider/emission, TC string, or CMP ID. Placeholders are built from `createElement` plus `textContent` with one static style constant, so no configuration string reaches markup (G-6). All placeholder prose comes from the i18n dictionaries (G-5). The pre-decision no-write test still passes, and blocking adds no storage path (CORE-8).
- **Documentation:** `packages/core/README.md` gained a full Blocking section (markup contract, option table, execution order, CSP nonce, placeholders, YouTube and Google Maps recipes, basic-mode Google tag, withdrawal, fail-closed rule) and its stale Phase 3 forward references were corrected; the root README moved to Phase 3 status. D-020..D-026 record the design decisions.
- **Self-review finding (fixed in this PR):** the unblock chain was extended with `.then()` and no `.catch()`, so a single failing round would have left the chain permanently rejected — silently dropping every later grant on the page and surfacing as an unhandled rejection rather than a contained failure. A failed round is now caught so the chain survives it. The regression test was verified to fail with the fix reverted.
- **PR review findings (fixed in this PR):** automated review of PR #6 surfaced three real library defects, logged as P-015..P-017. **P-015 (privacy-relevant):** a gate queued under a grant still executed if consent was withdrawn while the queue was parked on a slower gate; with the default `reloadOnWithdraw: false` nothing else stopped it, so a tracker could start after withdrawal. Each gate's grant is now re-read immediately before execution and a skipped gate stays eligible for a later grant. **P-016:** an inline `data-cmp-type="module"` gate resolved as if it were a classic inline script, but module evaluation is deferred, so a following classic gate could run ahead of it; inline modules are now awaited. **P-017:** `src` was removed from every non-script gate while only iframes had it restored, permanently breaking a generic `data-cmp-placeholder` gate on an `img` or `video`; removal is now confined to iframe gates. A follow-up round then found **P-018**, exposed by the P-015 fix: `executed` was set when a gate was *queued*, so `reloadOnWithdraw: true` discarded the page for a gate that was still parked behind a slower one, had been detached, or had failed to be re-created — a reload with nothing to undo. Queue state now lives in a separate `scheduled` flag and `executed` is set only where the replacement enters the document. Each fix has a regression test verified to fail with the fix reverted. A fourth finding was documentation-only: D-025 still described the dropped `sendBeacon` deletion, and now records the shipped interception-observability test instead.
- **Findings:** one real defect, in the fixture rather than the library, logged as P-014. `examples/basic-site` passed the placeholder string `"basic-js"` to `gtag("js", …)`, where real `gtag.js` requires a `Date`. The container initialized (its `gtm.load` event reached `dataLayer`) but fired no tag at all, so no `/g/collect` could ever be sent. This was only detectable once a real loader ran: it made the post-accept assertion unsatisfiable and, more seriously, would have made the pre-consent and post-reject silence assertions vacuous — they would have passed even with blocking removed. Confirmed with a 2x2 matrix against the live CDN (Date + consent → denied ping then `gcs=G111&gcu=1`; string → zero requests in both consent arms). The fixture now passes a real `Date`, and the CM-1 ordering assertion checks the command's position and shape because a live timestamp cannot be pinned. The checker's own expected-phase constant was advanced to 3.
- **Verdict:** pass

### Phase 4 — UI
- **Date / PR:** 2026-07-27 · this PR
- **Scope:** UI-1..UI-8. The US opt-out dialog (US-2) stays in Phase 6; the CLS, CSP and size audits belong to Phase 5, though `pnpm size` gates every commit regardless.
- **Implementation:** `@libreconsent/ui` renders both layers with `createElement` and `textContent` only, in an open shadow root by default (`shadow: false` falls back to the light DOM). The banner offers title, description, accept, reject and customize in `bar-bottom`, `box` or `modal` layouts; preferences offers per-category sections, per-service toggles with mixed-state category checkboxes, collapsible cookie tables, and save/accept/reject. Re-entry is available through a config-removable floating button, `data-cmp-open`, and `api.showPreferences()`.
- **Core changes (deliberately minimal):** `registerRenderer()` on `ConsentApi` so the existing `showPreferences()` / `hide()` intents become operative, and `region` on the `ready` payload so a renderer can tell which services are grantable before a decision exists. No UI configuration entered `CmpConfig` — D-027 records why.
- **Verification:** final `pnpm check` passed on 2026-07-27 **from a clean state with every `packages/*/dist` deleted** — traceability through Phase 4 (42 requirements), `tsc --noEmit` clean, Biome clean over 68 files, **217 unit tests** across 10 files (85 new: 76 in `packages/ui/src`, 6 in `packages/core/src/index.test.ts` for the renderer hook and `ready.region`, 2 in `scripts/serve-examples.test.mjs`), all package builds, size budgets, **29 E2E tests** (11 new in `tests/ui.e2e.spec.ts`), and **11 accessibility tests** (6 new in `tests/ui.a11y.spec.ts`) with zero serious or critical violations.
- **Measured size:** core IIFE **7.32 kB gzip** against the 8 kB limit (7.25 kB in Phase 3, so `registerRenderer` plus `ready.region` cost 70 B and 0.68 kB of headroom remains). **core+ui 13.98 kB / 15 kB**, of which the UI is 6.66 kB — 1.02 kB of headroom, the tightest budget in the project and the one Phase 5 should watch. bridge 318 B / 4 kB; head snippet 714 B / 1.5 kB.
- **Flagship:** `pre-consent-network-silence` re-run green with the UI mounted on `examples/basic-site` and **no assertion changed**. The renderer issues no network request of any kind, so the silence guarantee is unaffected.
- **Guardrails:** zero runtime dependencies (`@libreconsent/core` is a type-only devDependency; the built IIFE contains no import statement and no reference to `LibreConsentCore`). A scan of `packages/ui/src` for `eval`, `new Function`, `innerHTML`, `outerHTML`, `insertAdjacentHTML` and `document.write` returns nothing (G-6), as does a scan for `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `@import` and remote `url(...)` (UI-4 zero external assets, NFR-2/3). The renderer touches no storage API at all: only the core persists, and only after a decision (CORE-8). No TCF surface (G-1).
- **Accessibility:** axe-core reports zero critical or serious violations on the banner, on the preferences modal with a cookie table disclosed, and on the persistent settings button, each in both light and dark themes. Keyboard-only accept and reject journeys are enforced, as are focus trapping, Escape-to-close and focus restore. `specs/A11Y_CHECKLIST.md` carries the manual passes automation cannot judge.
- **Equal prominence:** accept and reject are emitted as the same element with the same class in the same action group. The E2E compares eleven computed properties plus bounding boxes, and additionally asserts the accept button's background is not transparent — without that guard the comparison passed while both buttons were unstyled (P-019).
- **Self-review findings (fixed in this PR):** P-019 (CSS reset specificity silently defeated all button theming and made the equal-prominence check vacuous), P-020 (removing the banner to open preferences detached the control that focus restore targeted), and P-021 (the UI package resolved `@libreconsent/core` through gitignored `dist/`, so it could not typecheck or test on a clean checkout even though every local run was green). P-019 and P-020 were caught by the Phase 4 gates rather than by inspection, which is the outcome the gates exist for; P-021 was found by deliberately deleting the build output, and the final `pnpm check` was re-run that way to prove it.
- **PR review findings (fixed in this PR):** P-022 — a single `releaseTrap` field served both layers, so opening preferences over a modal-layout banner overwrote the banner's release function and leaked its listener, and a decision taken in the second layer then made `closeBanner()` release the preferences trap instead of the banner's. Raised as a maintainability note by the PR review; a regression test that dispatches Escape at the closed layer (a detached node still runs a listener that was never removed) showed it was a real teardown defect, and it now fails without the two-field split.
- **Deliberate behaviour worth a reviewer's attention:** Escape is inert on the first layer, including the `modal` layout, while focus stays trapped there. D-034 records the reasoning — the first layer has no dismiss action, and reject is one equally-weighted keypress away. Escape does close the preferences layer.
- **Documentation:** `packages/ui/README.md` written from scratch (quickstart, option table, re-entry, theming tokens, i18n, accessibility, explicit non-behaviours); root README moved to Phase 4 status; `specs/A11Y_CHECKLIST.md` added for UI-3; D-027..D-033 record the design decisions.
- **Verdict:** pass
- **Findings:** the UI budget is the tightest in the project (1.02 kB of 15 kB left). Phase 5's size audit should treat further renderer growth as needing a trade, not headroom. The light-DOM fallback (`shadow: false`) cannot guarantee equal prominence against hostile host CSS; that limitation is inherent to the fallback and is stated in the package README.

### Phase 5 — Hardening
- **Date / PR:** 2026-07-27 · this PR
- **Scope:** BLK-4 and NFR-1..4. The CSP fixture the phase prompt lists as an audit item already shipped in Phase 3 (`examples/csp-site`, `tests/blocking.e2e.spec.ts`), so it was re-verified rather than built.
- **Measured sizes:** core IIFE **7.96 kB / 8 kB** gzip · core+ui **14.62 kB / 15 kB** · bridge **318 B / 4 kB** · head snippet **714 B / 1.5 kB**.
- **Implementation:** `blocking.blocklist: [{ pattern, category, service? }]` installs a two-part net. The `src` setter and `setAttribute` on `HTMLScriptElement.prototype` are patched so a matching, denied URL is **diverted into `data-cmp-src` and never assigned**, and the element is marked `type="text/plain"` plus `data-cmp-category` — it becomes exactly the gate the declarative markup produces, with no source to fetch. A `MutationObserver` then registers those elements (and any dynamically inserted declarative gate) so a later grant runs them through the unchanged ordered chain; `recreate()` reassembles the URL. `scan()` and the observer share one `track()` helper, which also owns `block()` so no registration path can leave an embed visible. Nothing is installed unless a pattern is configured, and `reset()` restores the prototype without clobbering a later foreign patch.
- **The technique had to change mid-phase.** The planned approach was the industry fallback: let the observer see the inserted script, veto `beforescriptexecute`, and detach the node. The BLK-4 E2E proved it does not work — the blocklisted script was still fetched and still executed in Chromium. Per the HTML standard, inserting a `<script src>` prepares it and starts its fetch, and removing it does not cancel the execution that follows because the element's node document is unchanged. Interception must precede insertion, which is why the prototype is patched. Logged as **P-023**; the reasoning is D-037. This is the phase's most important finding: the shipped mechanism is the only one that actually blocks, and had the E2E asserted only "the DOM looks gated" instead of "the URL was never requested", a feature that blocks nothing would have shipped looking green.
- **Verification:** final `pnpm check` passed on 2026-07-27 — traceability through Phase 5 (**47 requirements**), `tsc --noEmit` clean, Biome clean over **73 files**, **247 unit tests** across 11 files (30 new: 19 BLK-4 behaviours, 5 blocklist-validation cases and 1 order regression in `packages/core/src/blocking.test.ts`, 5 guardrail tests in `scripts/guardrails.test.mjs`), all package builds, size budgets, **40 E2E tests** (10 new: 8 BLK-4 in `tests/blocking.e2e.spec.ts`, 2 in `tests/hardening.e2e.spec.ts`), and **12 accessibility tests** including the new fixture.
- **Non-vacuity of the new gates** was established by breaking the implementation, not by inspection. Disabling the observer's `track()` call fails exactly the two registration tests; removing the inert marking fails six interception tests; removing the `!scanned` guard fails the order regression and nothing else; reverting the URL diversion fails the retype test; restoring the string-only type check fails the URL-object test. The BLK-4 E2Es assert the vendor URL appears in **no** network request while the un-blocklisted sibling appears in exactly one, so the silence cannot be an artifact of the test outrunning the network. The layout-shift spec ships a companion test that displaces real content and asserts the observer reports it — without which `toEqual([])` would pass just as well on a browser that never emits the entry type (D-039). One test (`never sees a dynamically injected inline script`) is documentation rather than coverage: `gate()` is only reachable from a `src` assignment, so no mutation of `observe()` can make it fail.
- **Self-review findings (all fixed in this PR).** An adversarial review of the finished implementation found four more real defects, three of them blockers, none of which the tests written alongside the implementation could catch:
  - **P-024 (worst of the phase):** configuring a blocklist **inverted BLK-1's document-order guarantee**. The observer sees parser-inserted nodes, so it registered gates parsed after `init()` ahead of gates parsed before it, while `scan()` appended the rest. A page of pure declarative markup — no dynamic injection at all — could run `gtag('config')` before `gtag/js` had loaded, purely because a blocklist was configured. An opt-in best-effort feature silently weakening a stated guarantee is the most serious class of defect here. The observer now registers nothing until the first scan (D-041).
  - **P-025:** the net **failed open on the most hardened pages**. A non-string `src` was skipped entirely, so a `TrustedScriptURL` — which is what conforming code must assign under `require-trusted-types-for 'script'` — or a plain `new URL(...)` never matched a pattern, and the tracker loaded while the configuration reported itself installed.
  - **P-026:** marking the element inert by `type` alone was **reversible**: `s.src = url; s.type = "text/javascript"` before insertion resurrected the tag, and because the element still carried `data-cmp-category` a later grant then ran it a second time. Hence the URL diversion (D-040), which removes the class of bug rather than patching the instance.
  - **P-027:** a gated `type="module"` script was replayed as a classic script after consent, dying on its first `import`. The original type is now preserved in `data-cmp-type`.
- **Bot review finding (P-028, fixed in this PR).** The PR bot reported that a script neutered while already connected is never registered for replay. Its stated case — `appendChild` then assign `src` in one task, the `__injectConnected` fixture — is **not** a defect: observer callbacks are delivered as microtasks after the task ends, so `element.matches(SCRIPT_GATE)` runs against the already-gated element and tracks it. A regression test now pins that. The underlying mechanism concern was real for an ordering the report did not identify: when the assignment happens in a **later task** than the insertion, the `childList` record was already delivered while the element was still a bare `<script>`, and diversion is attribute-only, so the observer never sees it. The element was correctly silenced but stayed inert **forever**, never replaying on a grant — a silent failure with no error and no fetch. `gate()` now registers the element itself when it is already connected and the first scan has happened; a detached element is still left to the observer. Verified in both jsdom and Chromium by reverting the fix (the E2E replays one gate instead of two).
- **Deliberately not changed:** `gate()` still returns early on `data-cmp-category` alone, so a malformed author gate (that attribute without `type="text/plain"`) disables the net for itself — it would execute anyway, and the 40 bytes of remaining core budget are better spent elsewhere. Cloning a gated element yields an untracked twin that a grant executes twice. A gate inside a shadow tree is not seen by the observer, which watches `document.documentElement` only, so it is registered only if its URL is assigned while it is already connected (the P-028 path); otherwise it fails closed and stays inert. Both are noted rather than fixed.
- **Flagship (03 §11.2):** re-run green with no assertion changed. The net is not active on `examples/basic-site`, which still gates the Google loader declaratively.
- **NFR-1 (size):** budgets already gate real built artifacts in CI, so the audit is the measurement above. BLK-4 cost 0.64 kB gzip on core (7.32 → 7.96 kB), of which roughly 0.12 kB is the five review fixes. **Core headroom is now 0.04 kB and core+ui 0.38 kB** — see Findings. No budget was raised, and correctness was not traded for margin: the P-024..P-027 fixes were kept even though they consumed most of what was left.
- **NFR-2 (performance):** `tests/hardening.e2e.spec.ts` asserts zero `layout-shift` entries through banner paint and preferences open on `examples/basic-site`, using a buffered PerformanceObserver installed before any page script. Both surfaces are `position: fixed`, so zero — not a threshold — is the correct assertion. Zero library-originated network remains proven by the flagship suite and now also by the source scan.
- **NFR-3 / NFR-4 (privacy, security):** the per-phase manual greps are now a permanent test. `scripts/guardrails.test.mjs` scans every shipped source file in core/ui/bridge for `eval`, `new Function`, `innerHTML`/`outerHTML`/`insertAdjacentHTML` assignment, `document.write`, `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `importScripts` and `__tcfapi` assignment, and asserts zero runtime dependencies and no install scripts. It strips comments so TSDoc prose cannot mask or fake a hit, guards against scanning nothing (≥ 10 files; 24 today), and proves its own detection on a synthetic violation. **Nothing fired on shipped source**, no regex was weakened, and the `EXCEPTIONS` allow-list is empty. It reads source rather than `dist/` because CI tests run before the build (D-038). `specs/SECURITY_CHECKLIST.md` carries the manual half.
- **Guardrails G-1..G-6:** all spot-checked, now largely by the scan above. The one thing the scan cannot express is judgement about the new prototype patch: it is a real global side effect, gated behind explicit configuration, scoped to script elements, reverted on `reset()`, and documented as such in both the package README and the checklist.
- **Documentation:** `packages/core/README.md` gained a "Dynamic injection safety net" section stating plainly what the net does not cover (parser-inserted scripts, dynamically injected inline scripts, code that bypasses the patched entry points) and that compliance must not rest on it; its stale "arrives in Phase 5" forward references are corrected. `packages/ui/README.md` gained a Layout stability section for NFR-2. Root README moved to Phase 5 status. D-036..D-039 record the decisions.
- **Verdict:** pass
- **Findings:**
  1. **The core budget was effectively exhausted — 0.04 kB of 8 kB left (40 bytes) — and has since been re-baselined (D-042).** This was a blocker for Phase 6, not a caution: GPC detection, the Do-Not-Sell dialog hook and US region logic cannot fit in 40 bytes, and at that margin even a comment-free one-line change could turn CI red — the P-028 fix alone consumed a third of what was left. **Resolution:** the maintainer re-baselined NFR-1 once, from measurement rather than estimate — core 8 → 12 kB and core+ui 15 → 19 kB, the two moving together because the UI's ~6.7 kB meant the 15 kB combined cap held core to ~8.3 kB anyway, making the core limit non-binding. No budget was touched *during* this phase, and the amendment is recorded with its projection (~9.5–10 kB at Phase 8) rather than fitted to whatever core happened to weigh. Splitting the US module out remains worthwhile on its own merits, now as an architecture choice rather than a forced one.
  2. **BLK-4's guarantee is narrower than the config surface suggests.** An operator can add a pattern and reasonably believe the tag is now blocked, when a parser-inserted copy of the same tag would still run. The README says so explicitly, but this is the requirement most likely to be over-trusted in the field, and KG-1's stance is unchanged.
  3. The net leaves a matching script completely alone once its category is granted. That is correct — the tag is authorized — but it means turning a category off does not retroactively cover scripts injected while it was on. Withdrawal semantics are BLK-5's `reloadOnWithdraw`, unchanged by this phase.

### Checklist re-verification for Phases 1–5 (04 §4)
- **Requirement IDs implemented and mapped:** yes — 47 requirements through Phase 5, enforced by `pnpm traceability` and the `Traceability` CI gate. `scripts/check-traceability.test.mjs` now asserts the marker is 5.
- **All phase tests green in CI:** yes — 247 unit, 40 E2E, 12 a11y, four size budgets, typecheck and lint, run as one `pnpm check`.
- **Guardrails G-1..G-6:** yes, and G-1/G-2/G-6 are now machine-enforced per run rather than re-grepped per phase.
- **Flagship still green:** yes, unchanged assertions, real vendored `gtag.js`.
- **Docs updated for public-facing changes:** yes — one new config option, one new documented limitation, two new checklists' worth of process.
- **research-at-implementation (CM-6, US-4):** no Google-specific behaviour changed in this phase, so the Phase 3 documentation record in `packages/core/README.md` still stands. US-4 remains Phase 6.
- **No weakened assertions:** confirmed. The 03 §11.2 endpoint list is intact, and the one assertion that changed in this phase (`script[src=…]` count) was corrected *toward* strictness — from "the node is gone" to "the URL was never requested and no executable script carries it".

### Phase 6 — US module
- **Date / PR:** 2026-07-27 / _this PR_ · **US-4 doc version consulted:** "Set up consent mode on websites" (updated 2026-05-06), Google Ads and Ad Manager US-states/RDP pages, and the W3C GPC Editor's Draft of 11 June 2026 — all retrieved 2026-07-27 and recorded with URLs in `specs/US_NOTES.md`.
- **Scope:** CFG-8, US-1..4.
- **Verdict:** pass — full local gate green on a clean tree; three self-review defects fixed and regression-tested before the PR was opened.
- **Verification:** 292 unit tests, 46 E2E, 14 a11y, four size budgets, typecheck, lint and traceability, all via `pnpm check` plus `pnpm e2e` and `pnpm a11y`. Traceability passes through **Phase 6 (52 requirements)**, and `scripts/check-traceability.test.mjs` now asserts the marker is 6.
- **Measured size:** core IIFE **8.4 kB** gzip of 12 kB; core+ui **15.9 kB** of 19 kB; bridge 318 B of 4 kB; head snippet 714 B of 1.5 kB. The US module cost ~0.44 kB on core and ~1.96 kB on the combined bundle, against D-042's ~1–1.5 kB projection for this phase — inside it on core, slightly over on the combined figure because the dialog and its four translations land in the UI. No budget was touched.
- **US-4 verdict — documentation only.** RDP is an account- and tag-level Google setting (`restricted_data_processing` on `gtag('config')`, `setPrivacySettings`, `rdp=1`), not a consent-mode signal, and Google states it receives GPC directly and applies RDP itself for those ad requests in applicable states; publishers "may choose" to also send a parameter. `ads_data_redaction` is a separate Consent Mode setting that only bites while `ad_storage` is denied, and the head snippet already emits it where configured. Setting any of these silently would decide the site owner's contractual posture with Google for them, so the library denies the three mapped ad signals and the README documents the tag-level parameters with a `change`-listener pattern. **No runtime work was needed and none was added.** The research also found the spec's own start URL (`adsense/answer/9561024`) returning HTTP 404 — recorded, with live replacements, rather than quietly substituted.
- **CORE-8:** holds. Neither the implied grant nor the GPC opt-out is persisted; `persistState` is reachable only from `applyDecision`, which strips both markers first. Four separate tests assert an empty cookie and empty localStorage after `ready`, and reverting the no-write property makes all four fail, so the assertions are not vacuous. What the implied grant *does* allow is third-party tags setting their own cookies before the visitor decides — that is the opt-out regime by design, and it is stated in both READMEs and the changelog rather than left implicit.
- **Guardrails G-1..G-6:** clean. `scripts/guardrails.test.mjs` covers the new `packages/ui/src/opt-out.ts` automatically (it walks the three package source trees), and `EXCEPTIONS` is still empty. Nothing TCF-shaped was added; the dialog is built with `el()` (text nodes only) so no markup sink is involved; reading `navigator.globalPrivacyControl` trips no network or eval pattern; zero runtime dependencies unchanged. `AD_SIGNALS` is exported from `config.ts` and imported by `lifecycle.ts`, which adds no cycle — `config.ts` imports only dictionaries, errors and types.
- **Flagship (03 §11.2):** re-run green, no assertion changed. `usPrivacy` is absent from `examples/basic-site`, so the pre-consent silence path is untouched by this phase.
- **Spec amendments (D-046).** Two sentences were changed rather than left to contradict the shipped code: CORE-3's `consent` event now reads "the first *active* state", and UI-7's no-pre-checked rule is scoped to opt-in flows. Both were approved by the maintainer before implementation, not retrofitted. CFG-8, US-1 and US-3 gained the clarifications D-043..D-045 settle.
- **Documentation:** `packages/core/README.md` gained a "US state privacy" section (option table, what an undecided US visitor sees, GPC precedence, the dialog, and the RDP non-integration with a worked `change`-listener example) plus the US-4 citations; `packages/ui/README.md` documents the dialog and the four new keys; the root README moved to Phase 6 status and points at Phase 7; `specs/A11Y_CHECKLIST.md` gained keyboard and screen-reader rows for the dialog; KG-6 and KG-8 record the research outcome and three watch items.
- **Bot review findings (P-032, P-033, fixed in this PR).** Both were real and both were verified by reverting the fix. The mapping check validated all four signals whenever `usPrivacy` was enabled, so a genuinely valid US-only configuration — an ad category, no analytics category, Consent Mode off — was rejected over an `analytics_storage` target nothing reads; the US-only branch now checks `AD_SIGNALS` only. More usefully, the reviewer caught that P-031's `enabled` guard was incomplete: it gated the delegated selector but not `api.showOptOut()` or the mount handle, so two programmatic paths could still open the dialog and persist a decision for a module the site had switched off. The guard moved into `showOptOut()` where it covers all three entry points, with the selector gate kept so a disabled module also stops swallowing the link's own click. That is the second time this phase that the interesting defect was an incomplete guard rather than a missing one.
- **Bot review finding (P-034, fixed in this PR).** A second reviewer flagged, explicitly as non-blocking, that the two dialog layers have no mutual-exclusion guard against each other. The stacking itself is harmless — `trapFocus` binds to its container, so stacked traps cannot fight — but the audit it prompted turned up a genuine asymmetry: `closeOptOut` refuses to reveal the banner while preferences are open (D-031), and `closePreferences` had no matching check for an open opt-out dialog. The reviewer's reason for calling it unlikely was sound for click paths only; `api.showPreferences()` is public and works while the dialog is open, so the order is reachable. Fixed with the symmetric guard, which also preserves the property that matters: whichever layer closes last still reveals the banner, so an undecided visitor is never stranded. Verified by reverting it.
- **Bot review findings (P-035, P-036, fixed in this PR).** A later review pass found two more, both real. The RDP example in `packages/core/README.md` listened only for `change`, so a restored opt-out — delivered once as the replayable `consent` event and never as `change` — would leave an operator's `restricted_data_processing` at its tag default for that whole session, and it derived the flag from `state.categories.marketing` rather than the configured mapping. That is the most consequential finding of the phase despite being documentation only: the code is right and the instructions for using it were not, which no test in this repo would have caught. Separately, an unparseable `doNotSellSelector` was accepted at `init()` and then silently discarded on every click, leaving the US-2 entry point dead without a word — CFG-6 requires a synchronous typed error naming the path, so `normalizeUsPrivacy` now parses the selector against a detached fragment. The UI's per-click guard stays as the net for a config that never went through `init()`, and its test now mounts a host-supplied `ConsentApi` to keep exercising it.
- **Findings:**
  1. **Three defects found by self-review, all fixed and regression-tested here (P-030, P-031).** Each regression was verified by reverting the fix and confirming the new test fails: `sanitizeStoredState` letting a restored decision claim `gpcApplied`; `doNotSellSelector` staying live under `enabled: false`; and dismissing the opt-out dialog over an open preferences layer revealing the banner behind it. The middle one is the most interesting, because the configuration looked harmless: a site that had switched the US model off could still record a decision — and silently dismiss its own consent banner — through a dialog it thought was disabled.
  2. **An undecided visitor outside a US region who follows a Do Not Sell link still records a decision.** With `usPrivacy.enabled` and a link rendered to EEA traffic, confirming the opt-out persists an all-denied state and the consent banner disappears without the visitor ever answering it. Nothing unlawful happens — no consent was given and none is recorded — and US-2 says the dialog "persists like any consent state", so this is left as-is. But it is a configuration a site can get wrong by rendering one footer to every audience, and the honest reading is that the dialog belongs on pages served to US visitors. Documented rather than silently restricted.
  3. **A GPC visitor sees "you have already opted out" for a state that is not stored.** The dialog reports the live state, which is correct and is what the visitor's browser asked for, but the opt-out lasts only as long as the signal does. This follows directly from D-044's decision not to persist, and the alternative — writing a record the visitor never made — is worse. Worth revisiting only if a site needs the opt-out to survive the signal being switched off.
  4. **The precedence rule in D-044 is a judgement call, not settled law.** CCPA § 7025(c)(3) frames a business's override of a signal as available *after* it notifies the consumer of the conflict, so "stored decision wins" is on firmest ground where that decision is a genuine informed choice made on the site — which it is here. Sites with substantial California traffic should consider surfacing the conflict; recorded in `specs/US_NOTES.md` §6 and KG-8 as a counsel-review item rather than resolved by engineering judgement.
  5. **Real GPC browsers are not exercised in CI.** Playwright 1.62 has no native GPC context option, so the E2E simulates the signal with `Sec-GPC: 1` and an injected `navigator.globalPrivacyControl`, and cannot exercise the spec's per-navigation caching. A negative-control test (same fixture, no signal, everything granted and both gated scripts running) keeps the GPC assertions from passing vacuously.

### Phase 7 — Bridge
- **Date / PR:** 2026-07-27 / _this PR_ · **G-1 audit (no writes/emissions):** clean
- **Scope:** BR-1..4.
- **Planned contract:** `initBridge(config)` observes a same-window external CMP through TCF v2 `addEventListener` and exposes read-only `getConsent()`, replayable `ready` / `consent`, non-replayable `change`, `on()` / `off()`, and teardown-only `reset()`. `DEFAULT_PURPOSE_MAPPING` and all public bridge types are package-root exports. D-050 clarifies that only callback-confirmed registration before the absolute deadline establishes `source: "tcf"`; returning from a queued stub is not itself readiness.
- **State boundary:** direct observations use the truthful bridge state from D-047 and never fabricate a core consent ID, revision, decision timestamp, or service choice. The strict default purpose aggregation and complete-replacement custom mapping are recorded in D-048.
- **Fallback boundary:** per D-049, full libreconsent is supplied as a dependency-free factory and initialized only after the discovery timeout. The bridge never imports core/UI, never renders its own surface, never calls the fallback's destructive `reset()`, and never emits an intermediate `source: "none"` before a fallback handoff.
- **TCF boundary:** listener registration/removal follows the official IAB CMP API v2 specification. Same-window consumption through `__tcfapi` is the sole G-1 exception; provider assignment, TC-string exposure/decoding, cross-frame proxying, vendor consent, legitimate-interest mapping, Google signals, DOM/storage/network access, and TCF certification remain excluded. GPP detection, parsing, emission, and `__gpp` provider behavior are also outside Phase 7.
- **Initial verification (superseded by follow-up):** the first full `pnpm check` passed with traceability through Phase 7, typecheck, Biome over 79 files, 337 unit tests across 11 files, every package build, all four size budgets, 54 E2E tests, and 15 accessibility tests. The bridge IIFE measured 2.64 kB gzip / 4 kB; the unchanged flagship suite and `git diff --check` passed. P-040..P-045 subsequently invalidated the Phase 7 closeout, including the browser side-effect evidence, so these counts are not the final gate.
- **Follow-up focused verification:** P-040/P-041 pass in the bridge package's **41/41** unit tests; its typecheck, Biome, build, **2.70 kB gzip / 4 kB** size gate, five source-guardrail tests, and `git diff --check` are green. P-042..P-044 pass in **7 bridge E2E**, **9 fixture E2E**, and **7 fixture a11y** tests, with typecheck, Biome, and `git diff --check` green. P-045 is closed by the GPP exclusions in the package/root READMEs, changelog, and this review.
- **Second full verification (superseded by teardown audit):** the corrected full `pnpm check` passed with traceability, typecheck, Biome over 79 files, 340 unit tests, every package build, all four size budgets, 54 E2E tests, and 15 accessibility tests. The bridge IIFE measured 2.70 kB gzip / 4 kB; the unchanged flagship suite and `git diff --check` passed. P-046 subsequently invalidated this closeout.
- **P-046 focused verification:** the bridge package is **42/42** after adding `removes a queued CMP listener whose first callback arrives after reset`; its IIFE is now **2.74 kB gzip / 4 kB**.
- **Third full verification (superseded by active-provider audit):** the P-046 full `pnpm check` passed with traceability, typecheck, Biome over **79 files**, **341 unit tests**, every package build, all four size budgets, **54 E2E tests**, and **15 accessibility tests**. The bridge measured **2.74 kB gzip / 4 kB**. P-047 subsequently invalidated this closeout.
- **P-047 focused verification:** the bridge package is **43/43** after adding `removes the listener through a CMP that replaced the queued stub` and strengthening the late-callback regression with the same provider handoff. All **8 bridge E2E** pass, including `teardown removes a queued listener through the replacement CMP provider (BR-1)`; focused typecheck, Biome, and `git diff --check` are green.
- **Fourth full verification (superseded by registration/setup audit):** the P-047 full `pnpm check` passed with traceability through **Phase 7 (56 requirements)**, typecheck, Biome over **79 files**, **342 unit tests**, every package build, all four size budgets, **55 E2E tests**, and **15 accessibility tests**. Measured gzip sizes were core **8.48 kB / 12 kB**, core+ui **15.98 kB / 19 kB**, bridge **2.77 kB / 4 kB**, and head snippet **714 B / 1.5 kB**. P-048/P-049 subsequently invalidated this closeout.
- **P-048/P-049 focused verification:** the bridge package is **47/47** after adding two synchronous-registration and two atomic-fallback-setup regressions and renaming the staged-reset proof. Typecheck, Biome, and `git diff --check` are green.
- **Fifth full verification (superseded by asynchronous-registration/deadline audit):** the P-048/P-049 full `pnpm check` passed with traceability through **Phase 7 (56 requirements)**, typecheck, Biome over **79 files**, **346 unit tests**, every package build, all four size budgets, **55 E2E tests**, and **15 accessibility tests**. Measured gzip sizes were core **8.48 kB / 12 kB**, core+ui **15.98 kB / 19 kB**, bridge **2.87 kB / 4 kB**, and head snippet **714 B / 1.5 kB**; `git diff --check` was clean. P-050/P-051 subsequently invalidated this closeout.
- **P-050/P-051 focused verification:** the bridge package is **53/53** after adding callback-confirmation, asynchronous-rejection, post-confirmation failure isolation, replacement-provider, late-confirmation, and delayed-deadline regressions.
- **Sixth full verification (superseded by listener-ownership audit):** the P-050/P-051 full `pnpm check` passed with traceability through **Phase 7 (56 requirements)**, typecheck, Biome over **79 files**, **352 unit tests**, every package build, all four size budgets, **55 E2E tests**, and **15 accessibility tests**. Measured gzip sizes were core **8.48 kB / 12 kB**, core+ui **15.98 kB / 19 kB**, bridge **2.99 kB / 4 kB**, and head snippet **714 B / 1.5 kB**; `git diff --check` was clean. P-052 subsequently invalidated this closeout.
- **P-052 focused verification:** the bridge package is **54/54** after adding `retains the CMP that confirmed the listener for teardown`; focused typecheck, Biome, and `git diff --check` are green.
- **Seventh full verification (superseded by confirmed-listener deadline audit):** the P-052 full `pnpm check` passed with traceability through **Phase 7 (56 requirements)**, typecheck, Biome over **79 files**, **353 unit tests**, every package build, all four size budgets, **55 E2E tests**, and **15 accessibility tests**. Measured gzip sizes were core **8.48 kB / 12 kB**, core+ui **15.98 kB / 19 kB**, bridge **3.03 kB / 4 kB**, and head snippet **714 B / 1.5 kB**. P-053 subsequently invalidated this closeout.
- **P-053 focused verification:** the bridge package is **55/55** after adding `keeps confirmed listener updates active after the discovery deadline`.
- **Final verification:** the P-053 full `pnpm check` passes with traceability through **Phase 7 (56 requirements)**, typecheck, Biome over **79 files**, **354 unit tests**, every package build, all four size budgets, **55 E2E tests**, and **15 accessibility tests**. Measured gzip sizes are core **8.48 kB / 12 kB**, core+ui **15.98 kB / 19 kB**, bridge **3.03 kB / 4 kB**, and head snippet **714 B / 1.5 kB**; `git diff --check` is clean.
- **Rendered QA:** Chrome confirmed timeout handoff to the real core/UI fallback, a single banner, a working accept journey, and no console errors.
- **G-1 / G-2 / G-6:** clean. P-046/P-047 prove that a numeric listener ID arriving after reset is used only to remove the external listener through the active provider, never to restore bridge state or events. The permanent source and strengthened browser proofs are green in the final full gate.
- **Verdict:** pass
- **Findings:**
  1. **P-037 (major): fallback readiness exposed two different truths.** When a fallback emitted `ready` with non-null consent, the bridge forwarded that state in the event payload before storing it, so `getConsent()` still returned null inside the callback. Active readiness now goes through observation first, making the event and read API coherent; the regression also pins defensive replay copies.
  2. **P-038 (minor): partial fallback subscription setup could leak callbacks.** Three `on()` calls were evaluated before their unsubscribe functions were pushed; if the second or third threw, earlier registrations were no longer reachable for cleanup. Each unsubscribe is now stored immediately, and a throwing later subscription proves partial cleanup.
  3. **P-039 (minor): the listener ID contract was broader than the IAB protocol.** Internal handling accepted a string ID even though the official CMP API v2 contract specifies a numeric `listenerId` and remove parameter. Registration and teardown now accept only numbers; tests pin both numeric removal and explicit rejection of a string ID.
  4. **P-040 (major, fixed): synchronous CMP replay could outpace registration state.** Resetting from a synchronously invoked `addEventListener` callback occurred before the external API reference was retained, so teardown could not remove the listener. Registration/reset is now atomic and a focused regression proves delayed listener removal.
  5. **P-041 (major, fixed): synchronous fallback replay could cross teardown.** Resetting from a fallback replay could be followed by setup storing fresh unsubscribe functions or callbacks repopulating cleared state. Every synchronous boundary is now reset-aware; captured callbacks stay inert and late-returning subscriptions are immediately disposed.
  6. **P-042 (major, fixed): the browser side-effect proof was vacuous for startup behavior.** Its baseline was captured after load and no write spies were installed, so an initialization mutation could become the accepted baseline. Instrumentation now exists before the bridge IIFE and covers every side-effect channel through initialization and callbacks.
  7. **P-043 (major, fixed): the `__tcfapi` identity proof did not pin its descriptor.** A `defineProperty` replacement reusing the same function could pass the value-only comparison. The regression now preserves and compares the exact own-property descriptor as well as callable identity through teardown.
  8. **P-044 (minor, fixed): the browser timeout assertion allowed a 25 ms-early result.** No early implementation behavior was observed, but a 225 ms lower bound could not prove a 250 ms contract. The assertion now rejects every early handoff while retaining bounded upper scheduling tolerance.
  9. **P-045 (minor, fixed): the documented exclusion boundary omitted GPP.** Package/root READMEs, changelog, and this review now state that GPP detection, parsing, emission, and `__gpp` provider behavior are outside Phase 7.
  10. **P-046 (major, fixed): a queued CMP's first listener ID could arrive after reset.** The bridge had already emitted `ready` with `source: "tcf"` and null consent, but reset had no listener ID and cleared the API reference; the later callback was ignored, leaking the external listener. Each registration now has a wrapper that, after invalidation, uses a late numeric ID solely for `removeEventListener` without restoring state or events.
  11. **P-047 (major, fixed): P-046 removed through the stale queued stub after a provider handoff.** The IAB stub pattern allows the real CMP to replace `window.__tcfapi` before it returns the listener ID, leaving the bridge's registration-time function obsolete. Both reset with a known ID and a first callback arriving after reset now resolve the active same-window provider at removal time, with the registration provider retained only as a fallback when live lookup is unavailable. Unit and browser regressions replace the queued stub before removal and prove that the live CMP receives `removeEventListener`.
  12. **P-048 (major, fixed): synchronous registration rejection was treated as TCF readiness.** A CMP responding to `addEventListener` with `success === false` had registered no listener, but the bridge unconditionally emitted `source: "tcf"` and stopped discovery. The registration wrapper now records a synchronous rejection before the provider call returns, publishes nothing for it, and resumes the same bounded polling path so a replacement CMP or timeout fallback can take over.
  13. **P-049 (major, fixed): synchronous fallback replay could publish before setup was viable.** A fallback could replay valid readiness or consent from its first `on()` call and then throw or return a non-function from a later subscription. Since bridge readiness is one-shot, cleanup could not replace the stale fallback outcome with `source: "none"`. Synchronous observations are now staged until all three subscriptions validate, then flushed in order; setup failure cleans every established subscription and discards the stage before failing closed.
  14. **P-050 (major, fixed): asynchronous registration rejection still followed irreversible TCF readiness.** P-048 covered only a callback made while the provider call remained on the stack. A queued or proxied CMP could return first and later report `success === false`, after `ready` had already committed the bridge to `source: "tcf"` with no listener and no remaining fallback path. D-050 now requires the first pre-deadline `success === true` callback to establish readiness; a silent stub remains pending without being registered twice, a replacement provider remains discoverable, asynchronous rejection resumes discovery, and a late listener confirmation is removed without displacing handoff.
  15. **P-051 (major, fixed): delayed polling could accept a CMP after the deadline.** Candidate lookup preceded the elapsed-time check, so a long task could install `window.__tcfapi` after `timeoutMs` and the delayed timer would still accept it. Every poll now enforces the absolute deadline before reading the provider, preserving the required `none` / fallback result.
  16. **P-052 (major, fixed): normal teardown could route a confirmed listener ID to an unrelated replacement provider.** The active-provider lookup added for queued-stub handoff was also used after ownership had already been confirmed. Since listener IDs are provider-local, replacing `window.__tcfapi` later could leak the original listener or remove an unrelated listener with the same ID. The first successful numeric callback now captures the ID and its live owning provider atomically; normal reset uses that stored owner, while pre-confirmation late/stale cleanup still resolves the live handoff provider.
  17. **P-053 (major, fixed): the discovery deadline was still enforced after successful registration.** A normal `useractioncomplete` callback arriving after the timeout entered the late-registration branch even though an earlier callback had already confirmed the listener, removing the active CMP listener and activating fallback after TCF readiness. The absolute deadline now applies only until first successful confirmation; the regression moves the clock beyond the deadline before the user's decision and proves TCF remains active without listener removal or fallback creation.

### Phase 8 — Worker log
- **Date / PR:** 2026-07-27 · [#12](https://github.com/nicolasestrem/libreconsent/pull/12) · **PII audit (no IP/UA): PASS**
- **Verdict:** **PASS** — LOG-1..4 are implemented and the phase may close.
- **Findings:**
  1. **PII/storage audit:** the tracked D1 migration has exactly eight columns:
     internal numeric ID, consent ID, host, revision, JSON categories, client
     timestamp, action, and server `received_at`. The runtime schema test
     inspects those columns and both indexes. Neither storage nor retrieval can
     represent IP, user agent, request headers, fingerprint, region, or service
     choices. Worker observability is explicitly disabled and JSON responses
     are `no-store`, so invocation logs and caches do not become secondary
     stores. P-055.
  2. **Core isolation:** `receiptEndpoint` is optional and normalized/frozen as
     the complete relative or absolute HTTP(S) target. Only explicit persisted
     decisions send. Restores, revision prefills, implied US grants, and GPC
     states stay silent; synchronous throws and promise rejection cannot alter
     state, persistence, events, or UI. The one LOG-4 guardrail waiver is
     file-and-pattern exact. P-054.
  3. **Worker boundary:** exact Origin allowlisting and matching payload host,
     16 KiB streaming cap, strict field/value validation, 30/minute
     `Origin + consentId` rate limit without IP, bearer-only ascending retrieval,
     and server-time retention all pass in the Cloudflare runtime against real
     isolated D1 migrations.
  4. **Remote proof:** dedicated Estrem test Worker and D1 resources completed
     migration/deploy, unique POST, bearer GET, and scheduled time-travel purge.
     Wrangler identified the D1 binding as `remote`; the deployed GET changed
     from one receipt to an empty trail. No test-only purge route exists. D-055;
     P-056.
  5. **Review patches:** documentation path ambiguity and the core evidence
     weaknesses were corrected. The final gate then caught the repository-level
     phase assertion still pinned to Phase 7; it now asserts Phase 8. P-054..P-058
     are closed; no blocker remains.
  6. **Final local gate before phase marker:** 390 unit/runtime tests (368
     repository + 22 Worker), 55 E2E, and 15 accessibility tests pass. Core is
     8.75/12 kB gzip, core+UI 16.25/19 kB, bridge 3.03/4 kB, and the head snippet
     714 B/1.5 kB.
  7. **PR review follow-up:** the account gate now targets the required `DB`
     binding rather than one account-specific database name, and the setup
     explicitly requires `DB.remote: true` only in the ignored test config.
     Custom test database names therefore resolve through their supplied
     Wrangler config while ordinary local development remains local-safe.
     P-059/P-060.
  8. **Post-merge review follow-up:** the scheduled test time now advances
     beyond the maximum accepted 3,650-day retention window rather than the
     395-day default, so every valid account configuration reaches the purge
     assertion. A pure boundary regression pins the relationship without
     requiring account credentials. P-061.

### Phase 9 — Release
- **Date / PR:** 2026-07-28 · Phase 9 PR pending · **TRACEABILITY audit: PASS — 60/60 requirements through completed Phase 8**
- **Scope:** NFR-5, NFR-6; `1.0.0` release candidate only — no npm publication, tag, merge, or deployment. The Phase 9 completion marker remains open until the required `v1.0.0` tag exists.
- **Verdict:** release-candidate gates pass locally; Phase 9 remains incomplete
  until tagging. `pnpm check`, Firefox/WebKit compatibility smoke,
  `git diff --check`, strict tarball inspection, temporary-consumer
  ESM/TypeScript/IIFE checks, and parsed npm publication dry-runs are green.
- **Verification:** final `pnpm check` passed on 2026-07-28 — traceability
  through completed Phase 8 (60 requirements), with the two Phase 9 rows also
  present and passing; strict TypeScript and Biome over 109
  files, 375 repository unit tests plus 22 Worker runtime/D1 tests, all package
  builds and four size ceilings, four strict tarballs and publication
  dry-runs, 66 Chromium E2E tests, 20 accessibility tests, and 10 focused
  Firefox/WebKit compatibility tests.
- **Measured size:** core 8.80/12 kB gzip; core+UI 16.35/19 kB; bridge
  3.08/4 kB; head snippet 0.76/1.5 kB.
- **Phase 8 prerequisite:** merged-main CI
  [run 30307539024](https://github.com/nicolasestrem/libreconsent/actions/runs/30307539024)
  passed. P-061 now advances the account purge clock by 3,651 days and its
  pure maximum-boundary regression is green. The ignored test-account config
  exists, but the URL, Origin, and bearer environment variables were
  unavailable, so this branch did not redeploy or rerun the external account
  round trip.
- **Review checklist:**
  1. NFR-5 and NFR-6 each have exactly one passing traceability row. The
     repository regression keeps Phase 8 and its 60 requirements as the latest
     completed set until the Phase 9 release tag exists.
  2. All four public packages align at `1.0.0`, carry MIT metadata and LICENSE
     files, expose package roots only, preserve generated JavaScript license
     banners, and have no third-party runtime dependency. The UI declares core
     `^1.0.0` as its required peer, and the release audit enforces that exact
     contract.
  3. Strict `npm pack` manifests contain only the declared bundles, types,
     documentation/license files, and the Worker's migration/example config;
     tests, specs, secrets, account configuration, and unrelated artifacts are
     absent.
  4. The Worker example targets `dist/index.js`, and `prepack` rebuilds before
     packing. A temporary consumer imports all four package roots at runtime
     and in strict TypeScript, validates three browser globals plus the head
     snippet, and proves deep imports reject.
  5. All four documented quickstarts and the local-only demo have expected
     consent behavior, no console/page errors, no unintended external request,
     and zero serious/critical axe finding. The three Consent Mode quickstarts
     embed the complete packaged synchronous head bootstrap and work without
     repository-only HTML preprocessing. Flagship pre-consent network silence
     remains green.
  6. Current official Google Consent Mode, Tag Manager, AdSense/Google Privacy
     & messaging, and GPC/RDP documentation was rechecked on 2026-07-28 and is
     cited in the release README and PR.
  7. Firefox and Playwright WebKit smoke all five release pages. This is not
     claimed as exact Safari 15.4 hardware coverage.
  8. Guardrails G-1..G-6 were rechecked by the authoritative gate: the bridge
     remains read-only, core/UI/bridge have no third-party runtime dependencies,
     UI's exact core peer is the sole first-party relationship, size ceilings
     are unchanged, and declarative network-silence coverage remains intact.
- **Launch limitations:** Phase 9 remains incomplete until `v1.0.0` is tagged.
  The bridge remains fixture-tested but unvalidated on
  a real AdSense domain using Google Privacy & messaging; exact Safari 15.4
  validation remains unproven; npm publication is deferred, so this work is a
  verified release candidate rather than registry availability.
- **Findings:** Phase 8 prerequisite P-061 and Phase 9 P-062..P-073 are fixed
  and regression-tested. No implementation blocker or major finding remains
  open; the required `v1.0.0` tag is the sole outstanding Phase 9
  definition-of-done item.

### Post-release-candidate — quickstart portability
- **Date / branch:** 2026-07-29 · `codex/v1-quickstart-portability` · **TRACEABILITY audit: PASS — 60/60 requirements through completed Phase 8**
- **Scope:** NFR-6 release-example hardening only. The completed-phase marker
  remains Phase 8; no package API, publication state, tag, deployment, or
  release claim changes.
- **Verdict:** pass — all four quickstarts load copied relative browser assets
  from a static server with no aliases, rewrites, preprocessing, or API
  emulation. The US example preserves `/api/region` as a production endpoint
  and fails closed when a static host returns 404.
- **Verification:** `pnpm check` passed on 2026-07-29: traceability through
  completed Phase 8 (60 requirements); 377 repository and 22 Worker tests;
  package builds; all four size limits (core 8.80/12 kB, core+UI 16.35/19 kB,
  bridge 3.08/4 kB, head snippet 763 B/1.5 kB); strict tarball inspection and
  publication dry-runs; 15 dedicated Chromium/Firefox/WebKit static-portability
  checks; 66 Chromium E2E tests; 20 accessibility tests; and 10 existing
  Firefox/WebKit compatibility smokes.
- **Findings:** P-074 closed. The first static suite correctly exposed that the
  US resolver's expected 404 is reported as a console error in Chromium and
  WebKit but not Firefox; coverage accepts only that expected diagnostic while
  retaining zero-tolerance for every other console or page error.
- **PR #15 review follow-up:** P-075 makes the CI `All gates` job execute the
  dedicated portability project after installing all three browser engines.
  Browser mirrors now update only through the explicit sync command, so release
  audit compares a fresh build with the committed mirror before any write can
  mask drift; the audit and browser assertion reject every root-absolute local
  `src` or `href` path.

### Phase 3B — workflow hardening
- **Date / branch:** 2026-07-29 · `codex/v1-workflow-hardening` ·
  **TRACEABILITY audit: PASS — 60/60 requirements through completed Phase 8**
- **Scope:** TOOL-4 workflow supply-chain hardening only. The completed-phase
  marker remains Phase 8; no package API, secret, tag, deployment, or
  publication state changes.
- **Verdict:** pass — the unused OpenCode wrapper is removed; remaining remote
  actions are exact SHAs; CI checkouts cannot retain credentials; and Claude's
  read-only/OIDC boundary is explicit. The guardrail accepts local actions and
  scans both YAML extensions while rejecting mutable references and missing
  checkout credential settings.
- **Verification:** `pnpm install --frozen-lockfile` and `pnpm check` passed on
  2026-07-29: workflow guardrails first; traceability through completed Phase 8
  (60 requirements); 387 repository and 22 Worker tests; package builds; all
  four size limits (core 8.80/12 kB, core+UI 16.35/19 kB, bridge 3.08/4 kB,
  head snippet 763 B/1.5 kB); strict tarball inspection and publication
  dry-runs; 15 dedicated Chromium/Firefox/WebKit static-portability checks; 66
  Chromium E2E tests; 20 accessibility tests; and 10 Firefox/WebKit
  compatibility smokes.
- **Findings:** P-076 closed. The now-unused `ZHIPU_API_KEY` secret was not
  removed; that external mutation remains out of scope pending separate
  explicit approval.

### Phase 3C — fixed-denied Consent Mode signals
- **Date / branch:** 2026-07-29 · `codex/v1-fixed-denied-consent-signals` ·
  **TRACEABILITY audit: PASS — 60/60 requirements through completed Phase 8**
- **Scope:** CFG-3, CM-1, CM-2, and US-1 clarification only. The completed
  phase marker remains Phase 8; no tag, publication, deployment, secret, or
  external service state changes.
- **Verdict:** pass — public mappings now allow only the exact fixed-denied
  policy object alongside legacy category strings. Runtime, UI, US/GPC, and the
  synchronous head bootstrap keep fixed advertising signals denied without
  creating categories; regional global defaults grant only string mappings.
  The canonical basic quickstart grants analytics only, and its refreshed
  checked artifacts and embedded bootstrap are byte-identical to the build.
- **Verification:** `pnpm install --frozen-lockfile` and `pnpm check` passed on
  2026-07-29: workflow and traceability checks through completed Phase 8 (60
  requirements); 411 repository and 22 Worker tests; package builds; all four
  size limits (core 8.99/12 kB, core+UI 16.57/19 kB, bridge 3.08/4 kB, head
  snippet 1.02/1.5 kB); strict tarball inspection and publication dry-runs; 15
  ordinary-static-server Chromium/Firefox/WebKit portability checks; 66
  Chromium E2E tests; 20 accessibility tests; and 10 Firefox/WebKit
  compatibility smokes.
- **Research evidence:** Google’s [Set up consent mode on websites](https://developers.google.com/tag-platform/security/guides/consent)
  was retrieved 2026-07-29 (page updated 2026-05-06). It confirms the four v2
  signals, defaults before measurement commands, updates after visitor choices,
  and regional defaults. The result is recorded under CM-6 without creating a
  new requirement.
- **Findings:** P-077 closed. Earlier fixed-entry behavior was unspecified;
  D-063 fixes its exact shape and fail-closed semantics. The initial
  quickstart-sync implementation mistook an already-current inline artifact for
  a missing marker; its explicit marker check is now idempotent and covered by
  the release audit.
