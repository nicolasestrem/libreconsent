# @libreconsent/core

Consent state, validation, first-party persistence, lifecycle events,
declarative script and embed blocking, and Google Consent Mode v2 signaling for
libreconsent. UI rendering arrives in a later phase.

## Quickstart

```ts
import { init } from "@libreconsent/core";

const consent = init({
  revision: 1,
  categories: [
    {
      id: "analytics",
      label: "category.analytics.label",
      description: "category.analytics.description",
      services: [
        {
          id: "ga4",
          label: "service.ga4.label",
          cookies: [
            {
              name: "_ga",
              purpose: "cookie.ga.purpose",
              provider: "cookie.google.provider",
              duration: "cookie.ga.duration",
              type: "cookie.http.type",
            },
          ],
        },
      ],
    },
  ],
  i18n: {
    default: "en",
    translations: {
      en: {
        "category.analytics.label": "Analytics",
        "category.analytics.description": "Helps us understand site usage.",
        "service.ga4.label": "Google Analytics 4",
        "cookie.ga.purpose": "Measures visits and usage.",
        "cookie.google.provider": "Google",
        "cookie.ga.duration": "Up to 2 years",
        "cookie.http.type": "HTTP cookie",
      },
    },
  },
});

consent.on("ready", ({ reason, consent: restored, prefill }) => {
  // Render a later-phase UI when `restored` is null. A revision prefill is
  // inactive until the visitor makes a fresh decision.
  console.log({ reason, restored, prefill });
});

consent.on("consent", (state) => {
  console.log("First active decision", state);
});

consent.on("change", (state) => {
  console.log("Updated decision", state);
});
```

`necessary` is injected as the first category when omitted. It is always
readonly and enabled. Optional categories default to disabled and cannot be
configured with `enabled: true`.

## Configuration

`init(config)` validates synchronously. Invalid values throw `ConsentError`
with a stable `code` and a precise `path`, for example
`categories[1].services[0].id`.

- `categories` are ordered and contain nested `services`. Category IDs must be
  unique, and service IDs must be globally unique across all categories.
- `label`, `description`, cookie `purpose`, and optional cookie `provider`,
  `duration`, and `type` values are translation keys. Every referenced key must
  exist in the default dictionary. Secondary locales may be partial and fall
  back to the default locale.
- `storage` defaults to cookie/localStorage key `libreconsent`, 365 days, and
  `SameSite=Lax`. `expiresDays` must be from 1 through 395.
- `blocking` defaults to no fallback nonce and `reloadOnWithdraw: false`. A
  supplied `nonce` must be a non-empty string.
- `revision` defaults to `1` and must be a positive integer.
- `consentMode` defaults to disabled, `denied-everywhere`, a 500 ms wait, and
  the standard analytics/marketing category mapping. `waitForUpdate` must be a
  positive integer.
- `i18n.default` defaults to `en`, `autoDetect` defaults to `false`, and English
  and French reference dictionaries are exported as `en` and `fr`.

`getConfig()` returns the fully normalized, deeply frozen configuration.
Repeated `init()` calls with the same normalized configuration return the same
API instance. A material mismatch, including a different `resolveRegion`
function identity, throws synchronously.

## Decisions and events

`getConsent()` returns only active consent, never revision-prefill data. Calls
to `acceptAll()`, `rejectAll()`, `setConsent()`, and `withdraw()` return `void`.
When region resolution or storage restoration is still running, calls are
queued and applied in order after `ready`.

```ts
consent.setConsent({
  categories: { analytics: true },
  services: { ga4: false },
});
```

Category changes apply first, explicit service changes override them, and
category values are then recomputed. A non-readonly optional category
containing services is true when at least one applicable service is accepted;
readonly categories retain their configured value. Unknown keys, non-boolean
values, and attempts to change readonly categories or their services throw
`ConsentError`.

`on(event, callback)` returns an unsubscribe function; `off()` is also
available. `ready` and `consent` replay to late subscribers, while `change`
does not. Initialization emits `ready` before a restored `consent`. The first
user decision emits `consent`; later decisions and withdrawal emit `change`.

`showPreferences()` and `hide()` are DOM-safe no-op intents in Phase 1 so an
integration can call them before the UI package exists.

## State and persistence

Each new decision lifecycle receives a UUIDv4 `consentId` and UTC ISO-8601
`createdAt`/`updatedAt` timestamps. Normal changes and withdrawal retain
`consentId` and `createdAt`; a renewed decision after expiry or revision
invalidation receives a new UUID.

No cookie or localStorage value is written before a user decision. The encoded
first-party cookie is authoritative and localStorage is its mirror/fallback:

- a valid cookie wins and may repair a missing or divergent mirror;
- a valid mirror may recover an absent, inaccessible, or corrupt cookie;
- invalid or unavailable storage never crashes initialization;
- decision expiry is measured from `updatedAt`;
- older revisions are inactive and exposed only as sanitized `ready.prefill`;
- withdrawal persists all optional choices as denied.

Cookies use `Path=/`, the configured domain, expiry, and SameSite value.
`Secure` is added only when the current page uses HTTPS.

`reset()` is a destructive test hook: it invalidates pending initialization,
removes listeners and stored consent, and releases the singleton.

## Region resolution

`resolveRegion` is optional and awaited before `ready`. Returned region codes
are normalized to uppercase. `null` or a rejected promise means unresolved
strict mode: services with `onlyRegions` remain denied. They also remain denied
when the resolved region is outside their allowlist.

The library performs no geo-IP request. On Cloudflare, expose the request
country through your own same-origin endpoint and opt into that request:

```ts
// Cloudflare Worker route: GET /consent-region
export default {
  async fetch(request: Request): Promise<Response> {
    const region =
      request.cf?.country ?? request.headers.get("CF-IPCountry") ?? null;

    return Response.json(
      { region },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  },
};
```

```ts
const consent = init({
  categories,
  resolveRegion: async () => {
    const response = await fetch("/consent-region", {
      credentials: "same-origin",
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return typeof value === "object" &&
      value !== null &&
      "region" in value &&
      typeof value.region === "string"
      ? value.region
      : null;
  },
});
```

Keep the resolver function in a stable variable if `init()` can be called more
than once; function identity is part of singleton configuration equality.

## Blocking

Blocking is opted into by markup, never by configuration: a page with no
`data-cmp-*` attributes behaves exactly as before. Every gate in the document is
held closed until the decision that opens it arrives, including a decision
restored from storage on a later page load.

The declarative markup below is the guarantee. Scripts that a third party
injects into the page at runtime are **not** intercepted in this release. A
best-effort `MutationObserver` net arrives in Phase 5 and will still be
documented as best-effort, never as a guarantee, because parser-inserted scripts
cannot be reliably neutered after the fact. Anything that must not run before
consent has to be authored as a gate.

### Markup

Three gates are recognized. The document is scanned once, as soon as it is
ready, so every gate present in the served HTML is found — and nothing added
afterwards is:

```html
<!-- External script. Nothing is fetched before consent. -->
<script type="text/plain" data-cmp-category="analytics" src="/analytics.js"></script>

<!-- Inline script. -->
<script type="text/plain" data-cmp-category="analytics">
  startTracking();
</script>

<!-- Embed. `src` is set only on consent. -->
<iframe
  data-cmp-src="https://example.com/embed"
  data-cmp-category="marketing"
  title="Example embed"
  width="560"
  height="315"
></iframe>

<!-- Any other element. Hidden until consent. -->
<div data-cmp-placeholder data-cmp-category="marketing">Ad slot</div>
```

| Attribute | Applies to | Meaning |
| --- | --- | --- |
| `type="text/plain"` | script gates | Required. Stops the browser executing the script while parsing. The real type is restored on consent. |
| `data-cmp-category` | every gate | Required. The category whose consent opens the gate. |
| `data-cmp-service` | every gate | Optional. The gate then opens on that service's consent instead of its category's. |
| `data-cmp-type` | script gates | Optional. Becomes the re-created script's `type`, for example `module`. A classic script is the default. |
| `data-cmp-src` | iframe gates | Required for an embed. Copied to `src` on consent. |
| `data-cmp-placeholder` | any element | Marks a non-iframe element as blocked content. Hides and reveals it; does not suppress requests. |

Author an embed with `data-cmp-src` and no `src`: the browser begins fetching a
real `src` while parsing the document, long before any consent code can run.

For the same reason `data-cmp-placeholder` alone is presentational. The parser
has already fetched any `src` on the element by the time consent code runs, so
the gate hides the element rather than silencing it, and the element's own `src`
is left untouched so revealing it cannot break it. Anything that must not reach
the network before a decision needs a script gate or `data-cmp-src`.

### Options

Both options tune how the guaranteed path behaves once gates exist; neither is
needed to turn blocking on.

| Option | Type | Default | Behavior |
| --- | --- | --- | --- |
| `blocking.nonce` | `string` | none | Fallback CSP nonce for re-created scripts that carry no nonce of their own. Must be a non-empty string. |
| `blocking.reloadOnWithdraw` | `boolean` | `false` | Reloads the page when consent is revoked for a script gate that already executed. |

### Execution order

Gated scripts execute in document order, which is what would have happened had
they never been gated. On consent a gate is replaced in place by a real
`<script>` element carrying every original attribute except `type`, `nonce`, and
each `data-cmp-*` attribute.

- An inline classic script runs synchronously the moment it is inserted.
- An inline `data-cmp-type="module"` script is awaited. Module evaluation is
  deferred even inline, so a following classic gate would otherwise run first.
- A `src` script without `async` is awaited: its `load` or `error` has to fire
  before the next gated script is inserted. Script-inserted scripts are async by
  default, so that default is explicitly cleared to hold the order.
- A `src` script carrying `async` is inserted without being awaited. Running out
  of order is exactly what `async` asks for.

A failed fetch never stalls the queue — an `error` settles the wait the same way
a `load` does — and a gate removed from the DOM before consent is skipped.

Every gate's consent is re-read immediately before it executes, not when its
round was queued. Withdrawing consent while the queue is parked on a slow script
therefore stops the gates behind it, and those gates stay eligible if consent is
granted again later.

### Content Security Policy

`blocking.nonce` supplies the nonce for re-created scripts, so a strict
`script-src 'nonce-…'` policy admits them. A nonce on the gate element itself
always wins over the configured value.

```ts
const consent = init({
  categories,
  blocking: { nonce: "r4nd0mPerRequest" },
});
```

Generate that value per response on the server and use the same string in the
CSP header and here. The gate element's `nonce` IDL property is read before its
`nonce` attribute, because CSP nonce hiding blanks the content attribute after
parsing: reading the attribute alone would silently drop the nonce and the
re-created script would be refused.

### Placeholders

A blocked embed or placeholder element is hidden with both the `hidden` attribute
and an inline `display:none`, since `hidden` alone loses to a site stylesheet's
`display` rule. The element's own inline `display` value is remembered and
restored when the embed is revealed.

A `<div data-libreconsent-placeholder>` is then inserted immediately before the
blocked element, holding the `blocked.notice` text and a button labelled
`blocked.accept`. Clicking the button grants that gate's category — or its
service, when `data-cmp-service` is present — through `setConsent`, so the embed
appears and the decision persists like any other. Both keys ship in the EN and
FR dictionaries, and a supplied value wins over the shipped one like every other
translation key:

```ts
const consent = init({
  categories,
  i18n: {
    translations: {
      en: {
        "blocked.notice": "This map loads only if you accept marketing cookies.",
        "blocked.accept": "Load the map",
      },
    },
  },
});
```

The reference dictionaries are merged underneath, so overriding one key does not
oblige you to restate the rest.

Styling is a single minimal inline rule — a border, padding, centered text — and
no external asset, so a placeholder is legible on any page without shipping CSS.
Themed presentation arrives with the UI package in Phase 4.

### Embed recipes

For YouTube, prefer `youtube-nocookie.com` over `youtube.com`: it is Google's
privacy-enhanced embed host.

```html
<iframe
  data-cmp-src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
  data-cmp-category="marketing"
  title="Product walkthrough"
  width="560"
  height="315"
  allowfullscreen
></iframe>
```

For Google Maps, copy the `pb` parameter out of the share dialog's embed code
into `data-cmp-src`:

```html
<iframe
  data-cmp-src="https://www.google.com/maps/embed?pb=EMBED_PARAMS"
  data-cmp-category="marketing"
  title="Our office location"
  width="600"
  height="450"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>
```

Both carry a `title`. An iframe without one is unlabelled for screen-reader
users, and a gate does not invent one.

### Google tags in basic mode

Basic mode means no Google request happens before a decision, which is exactly
what a script gate delivers. Keep the head placement described under
[Google Consent Mode v2](#google-consent-mode-v2) and gate `gtag.js` itself:

```html
<script>
  window.libreconsentConsentMode = {
    enabled: true,
    defaults: "denied-everywhere",
    waitForUpdate: 500,
  };
</script>
<script>
  /* Paste packages/core/dist/head-snippet.global.js here. */
</script>
<script>
  gtag("js", new Date());
  gtag("config", "G-XXXX");
</script>
<script
  type="text/plain"
  data-cmp-category="analytics"
  src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"
></script>
```

The head artifact installs `window.dataLayer` and the standard `gtag` stub, so
the `js` and `config` commands queue harmlessly with no tag present. When
consent opens the gate, `gtag.js` loads and processes the queue in order, with
the consent `default` already ahead of it.

### Withdrawal

Withdrawing or narrowing consent re-blocks embeds: `src` is removed, the element
is hidden again, and its placeholder returns. Consent state, persisted storage,
and Consent Mode signals update immediately in every case.

A script that was granted but has not executed yet — one still waiting behind a
slow gate in the queue — is stopped rather than run, and becomes eligible again
only if consent returns.

A script that has already executed cannot be un-executed. Nothing in this
library can retract code the browser has already run, and whatever globals,
cookies, or listeners it created outlive the withdrawal. That is a documented
limitation of consent management in general, not a defect to be worked around.

`blocking.reloadOnWithdraw: true` is the only way to undo an executed script's
effects: when consent is revoked for a gate that ran during this page view, the
page reloads, and after the reload the gate simply never opens. The cost is
plain — the visitor loses scroll position, form input, and any unsaved
client-side state at the moment they change their mind — so it stays off by
default. Only gates whose replacement actually entered the document during the
current page view can trigger it, so a page loaded with that consent already
denied never reloads, and neither does a gate that was queued but stopped, was
removed from the DOM before its turn, or failed to be re-created. A reload is
reserved for effects that really exist.

### Gates fail closed

A gate naming a category or service that does not exist in the configuration
stays blocked forever, and silently. An unknown ID simply reads as not granted,
and no decision can open it; its placeholder's accept button is inert rather
than an error. The same holds for a gate naming a service whose `onlyRegions`
allowlist excludes the resolved region, or whose region never resolved at all. A
typo therefore costs a tag or an embed, never a leak — so after renaming a
category or service, check the rendered page for gates left behind.

## Google Consent Mode v2

Basic mode is the recommended finished deployment: put Google tags behind a
declarative script gate, so no Google request is made before a decision. That
gate now ships — see [Blocking](#blocking), and
[Google tags in basic mode](#google-tags-in-basic-mode) for the head placement
plus gate combined. Advanced mode loads Google tags immediately, which can send
cookieless pings before consent; choose it only when that measurement tradeoff
matches your policy.

Define one `ConsentModeConfig` object in the document head, expose it as
`window.libreconsentConsentMode`, and copy the built
`packages/core/dist/head-snippet.global.js` inline immediately after it. The
same object is then supplied to `init()`. The artifact queues the consent
default synchronously before every Google `js`, `config`, event, or GTM
bootstrap command.

```html
<script>
  window.libreconsentConsentMode = {
    enabled: true,
    defaults: "denied-everywhere",
    waitForUpdate: 500,
    adsDataRedaction: true,
    urlPassthrough: true,
  };
</script>
<script>
  /* Paste packages/core/dist/head-snippet.global.js here. */
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<script>
  gtag("js", new Date());
  gtag("config", "G-XXXX");
</script>
```

That loader tag is unconditional, which is the advanced-mode shape. Replace it
with the gated form under
[Google tags in basic mode](#google-tags-in-basic-mode) for a basic deployment.

For regional defaults, the artifact first denies the four v2 signals in the
listed regions, then queues a global granted fallback for everyone else:

```js
window.libreconsentConsentMode = {
  enabled: true,
  defaults: { deniedRegions: ["FR", "US-CA"] },
  waitForUpdate: 500,
};
```

Reuse the exact object during initialization:

```ts
const consent = init({
  categories,
  consentMode: window.libreconsentConsentMode,
});
```

When enabled, the core subscribes once to replayed `consent` and subsequent
`change` events, including restored consent and withdrawal. It sends every v2
signal as `granted` or `denied` from the effective mapped category. Signaling
failures never interrupt persistence or lifecycle events. With `enabled:
false`, the adapter does not touch browser globals or subscribe to lifecycle
events. A malformed standalone bootstrap value fails closed to a
denied-everywhere default with a 500 ms wait; `init()` still rejects malformed
configuration synchronously with `ConsentError`.

`adsDataRedaction: true` queues Google’s redaction setting, which only takes
effect while `ad_storage` is denied. `urlPassthrough: true` is queued before
any Google configuration/event command.

### Google Tag Manager

The page-level fallback is the same head placement: put the copied artifact
before the GTM bootstrap snippet. It ensures all defaults are already queued
before the container's Consent Initialization work starts. For a GTM-native
implementation, Google documents a Consent Initialization – All Pages trigger
using `setDefaultConsentState` and `updateConsentState`; a GTM Community
Template is deliberately deferred until after v1.

Consent Mode defaults and updates on their own do not keep the network quiet
before a decision: they tell Google how to behave, not whether to load. The
network-silence guarantee comes from gating the tag itself, which
[Blocking](#blocking) covers.

### Consulted Google documentation

Accessed 2026-07-26:

- [Set up consent mode on websites](https://developers.google.com/tag-platform/security/guides/consent), updated 2026-05-06.
- [Google tag API reference](https://developers.google.com/tag-platform/gtagjs/reference), updated 2026-04-17.
- [GTM consent-template APIs](https://developers.google.com/tag-platform/tag-manager/templates/consent-apis), updated 2026-03-05.

## Public API

The package root exports `init`, `ConsentError`, the EN/FR dictionaries, and
TSDoc-documented configuration, normalized configuration, state, selection,
event, error-code, and cookie-row types. Imports from internal source files are
not public API.

## Build and test

```sh
pnpm --filter @libreconsent/core build
pnpm --filter @libreconsent/core test
```
