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
- **Deliberate behaviour worth a reviewer's attention:** Escape is inert on the first layer, including the `modal` layout, while focus stays trapped there. D-034 records the reasoning — the first layer has no dismiss action, and reject is one equally-weighted keypress away. Escape does close the preferences layer.
- **Documentation:** `packages/ui/README.md` written from scratch (quickstart, option table, re-entry, theming tokens, i18n, accessibility, explicit non-behaviours); root README moved to Phase 4 status; `specs/A11Y_CHECKLIST.md` added for UI-3; D-027..D-033 record the design decisions.
- **Verdict:** pass
- **Findings:** the UI budget is the tightest in the project (1.02 kB of 15 kB left). Phase 5's size audit should treat further renderer growth as needing a trade, not headroom. The light-DOM fallback (`shadow: false`) cannot guarantee equal prominence against hostile host CSS; that limitation is inherent to the fallback and is stated in the package README.

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
