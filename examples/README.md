# Examples

Two kinds of page live in this directory and the difference matters.

- **Quickstarts and the demo** are written to be read and copied. They contain
  the head bootstrap, the gate markup, and the configuration a real deployment
  needs.
- **Fixtures** exist for the Playwright suites. They are shaped by what a test
  has to assert — pinned regions, fake CMPs, global counters, deliberately
  broken paths — and several of them would be wrong on a live site. Do not copy
  a fixture into production.

Every page here loads local stand-ins instead of real vendor URLs, so nothing
under `examples/` contacts a third party.

## Running them

Build first; both servers hand out built browser artifacts.

```sh
pnpm build
```

`pnpm examples:serve` starts an HTTP server on port 4173 rooted at this
directory, with two additions the fixtures depend on: it maps
`/dist/core.global.js`, `/dist/ui.global.js`, and `/dist/bridge.global.js` onto
the freshly built package artifacts, and it replaces the
`<!-- LIBRECONSENT_HEAD_SNIPPET -->` marker with the built Consent Mode head
snippet. `/` serves `basic-site/index.html`. The fixtures and the demo site
need this server.

```sh
pnpm examples:serve
```

`pnpm quickstarts:serve` starts a plain static file server on port 4174 over
the same directory — no route mapping, no marker substitution, nothing a
generic static host would not do. `/` serves
`quickstarts/basic-consent-mode/index.html`. This is the server
`pnpm quickstarts:portability` runs against, which is the point: it proves the
quickstarts work as copied files rather than as a repository-only setup.

```sh
pnpm quickstarts:serve
```

Both honor `PORT`.

## Quickstarts

Copy the whole `quickstarts/<name>/` directory, and copy
`vendor/libreconsent/` beside it so the relative script URLs still resolve.
Then replace the local loader URLs, which are marked in the markup.

| Directory | What it shows |
|---|---|
| [`quickstarts/basic-consent-mode`](quickstarts/basic-consent-mode/index.html) | Consent Mode v2 with analytics only. `analytics_storage` follows the `analytics` category; the three ad signals are `{ mode: "fixed", value: "denied" }` and never grant. The inline head bootstrap runs before `gtag("js", …)`, and the analytics loader is a `type="text/plain"` gate, so nothing is fetched before a decision. |
| [`quickstarts/gtm-basic-mode`](quickstarts/gtm-basic-mode/index.html) | The same head bootstrap placed before the `gtm.js` container marker is pushed to `dataLayer`, with the container loader itself gated on `analytics`. Basic mode: no container request happens before consent. |
| [`quickstarts/adsense-bridge`](quickstarts/adsense-bridge/index.html) | `initBridge()` observing an external TCF CMP read-only and printing each `ready` / `consent` / `change` payload. No banner is rendered, no `__tcfapi` is provided, and the page does not make libreconsent a certified CMP. |
| [`quickstarts/us-only-opt-out`](quickstarts/us-only-opt-out/index.html) | The US opt-out model: region resolved from a same-origin `/api/region` endpoint, an in-memory implied grant, GPC, and a "Do Not Sell or Share" link wired through `usPrivacy.doNotSellSelector`. `region-resolver-worker.js` in the same directory is the Cloudflare Worker that endpoint expects — it returns `CF-IPCountry` and nothing else. |

On a static-only host `/api/region` returns 404, the resolver reports `null`,
and the US quickstart fails closed to the opt-in banner. That is the intended
behavior, not a broken example.

[`demo-site`](demo-site/index.html) is the fifth page worth reading: accept,
reject, customize, withdrawal, re-entry, a gated local script, a gated local
iframe, and the live consent state rendered as JSON. It loads its artifacts
from the `/dist/…` routes, so it runs under `pnpm examples:serve` only.

[`theme-studio`](theme-studio/index.html) is a sixth, interactive page: a
visual customizer for the banner. Pick a preset, drag the color and shape
controls, or roll the dice, and the live banner remounts to match. A contrast
checker flags sub-4.5:1 pairs, and the result exports as CSS custom
properties, a `mount()` snippet, or a shareable URL. Like the demo it loads
`/dist/…` artifacts, so it runs under `pnpm examples:serve` only.

## Shared browser artifacts

`vendor/libreconsent/` holds tracked copies of the built IIFE bundles and the
Consent Mode head snippet. The quickstarts load them through relative URLs so
that a copied directory works unchanged on any static server.

These are mirrors, not sources. `pnpm quickstarts:sync-assets` regenerates them
from `packages/*/dist/` after a build, and the release audit fails if a mirror
or an inline head copy has drifted from the packaged artifact.

## Test fixtures

Internal. Used by the Playwright end-to-end and accessibility suites under
`tests/`, served by `pnpm examples:serve`, and not intended as starting points.

| Directory | Exercised by |
|---|---|
| `basic-site` | The pre-consent network-silence gate against real vendored `gtag.js`, the UI end-to-end and axe-core passes, and the layout-shift assertions. |
| `blocking-site` | Declarative gate ordering: inline and `src` scripts, `async`, an iframe `data-cmp-src` embed, and a `data-cmp-placeholder` element. Records execution order in a global. |
| `bridge-site` | Bridge discovery scenarios. Installs a scripted fake `__tcfapi` whose behavior is selected by a `?scenario=` query parameter, and counts provider assignments. |
| `csp-site` | Nonce propagation under a `script-src 'self' 'nonce-…'` policy, collecting `securitypolicyviolation` events. |
| `dynamic-site` | The best-effort blocklist net. Injects a matching and a non-matching script at runtime the way a tag manager would. |
| `gtm-site` | Consent Mode regional defaults ahead of a `dataLayer` consent-initialization push. |
| `us-only-site` | The US opt-out path with the resolved region pinned to `US-CA` so no network request is needed. |

Fixture pages set globals such as `window.__lcApi`, `window.__order`, and
`window.__executed` purely so tests can assert against them, and several pin
values a real deployment must resolve at runtime. Start from a quickstart
instead.
