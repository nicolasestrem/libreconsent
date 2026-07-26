# @libreconsent/core

Consent state, validation, first-party persistence, and lifecycle events for
libreconsent. Phase 1 deliberately does not render UI, block scripts, or signal
Google Consent Mode; those integrations are added in later phases.

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
- `revision` defaults to `1` and must be a positive integer.
- `consentMode` is normalized in Phase 1 but not signaled until Phase 2. It
  defaults to disabled, `denied-everywhere`, a 500 ms wait, and the standard
  analytics/marketing category mapping.
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
