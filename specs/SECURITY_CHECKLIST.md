# SECURITY — manual security and privacy checklist

Required by **NFR-3** and **NFR-4** (03 §10) and guardrails G-1, G-2, G-6 (04 §2).
`scripts/guardrails.test.mjs` enforces the mechanical half on every CI run; this
checklist covers what a static scan cannot judge. Run it whenever a shipped
package changes materially, and record the date and result in
`specs/05_BUILD_REVIEW.md`.

Automated coverage already enforced in CI (gate "Unit tests" for the scan, "Size
budgets" for NFR-1, "E2E tests" for the CSP and network-silence fixtures):

- No `eval`, `new Function`, `innerHTML` / `outerHTML` / `insertAdjacentHTML`
  assignment, or `document.write` in `packages/{core,ui,bridge}/src` (G-6).
- No `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource` or
  `importScripts` in those sources — the library originates no network request
  (NFR-2, NFR-3).
- No `__tcfapi` assignment anywhere; read-only consumption in `bridge` is the one
  permitted exception (G-1).
- `core`, `ui` and `bridge` declare no runtime dependencies and no install
  scripts (G-2, supply chain).
- `EXCEPTIONS` in the scan is empty, and any future entry must be a reviewed
  diff naming the requirement that justifies it.

## Code and supply chain

- [ ] `pnpm-lock.yaml` changes in this diff are intentional and every new
      dev-dependency was reviewed; no dependency was added to a shipped package.
- [ ] No new global side effect beyond those documented. The BLK-4 net's
      `HTMLScriptElement.prototype` patch is installed only when a blocklist is
      configured, is scoped to script elements, and is reverted by `reset()`.
- [ ] No shipped source reads a configuration string into a DOM sink. Placeholder
      and UI text reach the DOM through `textContent` only.
- [ ] Built `dist/` artifacts spot-checked after `pnpm build` for anything the
      source scan cannot see (the scan reads source because CI tests run before
      the build).
- [ ] No debugging residue: no `console.*`, no `debugger`, no commented-out
      credentials or endpoints.

## Content Security Policy (BLK-2, NFR-4)

- [ ] `examples/csp-site` still passes with zero `securitypolicyviolation`
      events, and its policy has not been loosened to make a test pass.
- [ ] Re-created scripts carry a nonce from the element first, then
      `blocking.nonce`; a per-element nonce always wins.
- [ ] The UI needs no `'unsafe-inline'` for `style-src`: styles are adopted
      through a constructable stylesheet, with a `<style>` fallback only for
      Safari below 16.4 (D-033).
- [ ] The documented quickstarts do not instruct operators to weaken their CSP.

## Storage and privacy (CORE-8, NFR-3)

- [ ] Nothing is written to cookies, `localStorage`, `sessionStorage`,
      IndexedDB or the Cache API before a user decision.
- [ ] All consent storage is first-party: no third-party cookie, no cross-origin
      write, no redirect-based identifier.
- [ ] The consent record contains no IP address, user agent, or fingerprinting
      signal.
- [ ] No telemetry, no phone-home, and no CDN is required to run the library;
      self-hosting is the documented default.
- [ ] The optional receipt endpoint (LOG-4, Phase 8) remains opt-in and off by
      default, and its failure can never affect the consent UX.

## Isolation

- [ ] A throwing host callback cannot break the consent lifecycle, and a
      throwing renderer cannot propagate into page code.
- [ ] Gates naming unknown categories or services fail closed, silently.
- [ ] The library exposes no way for page code to read or alter another origin's
      consent state.
