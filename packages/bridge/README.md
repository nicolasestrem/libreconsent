# @libreconsent/bridge

Read consent from an external IAB TCF CMP without becoming a TCF CMP.

The bridge is UI-less and read-only. It observes a same-window `__tcfapi`,
maps TCF purpose consents to libreconsent categories, and exposes
libreconsent-compatible read and event methods. It never provides or assigns
`__tcfapi`, returns a TC string, renders a consent surface, writes storage,
loads a network resource, or emits Google consent signals.

## Quick start

```ts
import { initBridge } from "@libreconsent/bridge";

const bridge = initBridge({});

bridge.on("ready", ({ source, consent }) => {
  console.log("Consent owner:", source);
  console.log("Current consent:", consent);
});

bridge.on("change", (consent) => {
  console.log("External consent changed:", consent);
});
```

The package root exports the runtime values `initBridge` and
`DEFAULT_PURPOSE_MAPPING`, plus the documented TypeScript interfaces
`PurposeMapping`, `BridgeConfig`, `BridgeConsentState`, `BridgeReadyEvent`,
`BridgeEvents`, `BridgeApi`, `BridgeFallbackConsentState`,
`BridgeFallbackReadyEvent`, and `BridgeFallbackApi`. The IIFE build exposes the
runtime values on `LibreConsentBridge`.

`initBridge()` polls for a same-window CMP for 3 seconds by default. Discovery
uses exponential backoff from 10 ms up to 250 ms, then subscribes with the TCF
v2 `addEventListener` command.

Cross-frame CMP discovery and proxying are outside the bridge's scope. If the
CMP only exists in an ancestor frame, provide a same-window proxy yourself or
use the fallback described below.

## Configuration

```ts
interface BridgeConfig {
  timeoutMs?: number;
  purposeMapping?: Record<string, PurposeMapping>;
  fallback?: () => BridgeFallbackApi;
}
```

| Option | Default | Behavior |
|---|---|---|
| `timeoutMs` | `3000` | Positive integer absolute deadline, in milliseconds, for discovering `window.__tcfapi` and receiving successful listener-registration confirmation. |
| `purposeMapping` | `DEFAULT_PURPOSE_MAPPING` | Complete replacement mapping from category IDs to TCF purposes. It is not merged with the defaults. |
| `fallback` | none | Factory invoked only after the discovery deadline. It returns a structural read/events API compatible with the core `ConsentApi`. |

Invalid configuration throws synchronously. `necessary` is always granted and
cannot be remapped.

Repeated initialization with the same normalized timeout, mapping, and fallback
factory identity returns the same bridge singleton. A material mismatch throws
synchronously. Call `reset()` before intentionally replacing bridge
configuration.

## Default purpose mapping

```ts
import { DEFAULT_PURPOSE_MAPPING } from "@libreconsent/bridge";

// Equivalent data:
const purposeMapping = {
  analytics: { purposes: [1, 7, 8, 9, 10], match: "all" },
  marketing: { purposes: [1, 2, 3, 4], match: "all" },
};
```

The exported default and its nested values are frozen. Every listed purpose
must be granted because both entries use `match: "all"`.

A custom mapping replaces the defaults completely:

```ts
const bridge = initBridge({
  purposeMapping: {
    analytics: { purposes: [1, 7], match: "all" },
    personalization: { purposes: [4, 5, 6], match: "any" },
  },
});
```

Use `match: "all"` when every purpose is necessary for the category and
`match: "any"` when one granted purpose is sufficient. The bridge reads
`purpose.consents` only. Legitimate-interest fields, vendor-level consent,
direct service-purpose mapping, and TC-string decoding are intentionally not
implemented. GPP detection, parsing, emission, and `__gpp` provider behavior are
also outside this TCF-only bridge.

## State and events

`getConsent()` returns `BridgeConsentState | null`:

```ts
interface BridgeConsentState {
  source: "tcf" | "fallback";
  categories: Record<string, boolean>;
  services: Record<string, boolean>;
  gdprApplies: boolean | null;
  observedAt: string;
}
```

The bridge reports only what it observed. A direct TCF state has an empty
`services` record because the mapping is category-level. It does not fabricate
a consent ID, decision timestamp, revision, persisted-decision marker, or
service choice. A fallback state preserves the fallback API's category and
service records while identifying its source as `"fallback"`.

Events follow the core lifecycle shape:

- `ready` is replayable and fires once. Its `source` is `"tcf"`, `"none"`, or
  `"fallback"`, and `consent` may be null.
- `consent` is replayable and carries the first usable consent state.
- `change` is not replayable and carries later materially different states.
- `on()` returns an unsubscribe function; `off()` removes a listener.
- Listener exceptions are isolated and cannot stop other listeners or bridge
  lifecycle work.

If `gdprApplies` is `false`, every mapped category is granted and `ready`
precedes `consent`. For applicable GDPR traffic, `tcloaded` and
`useractioncomplete` callbacks are mapped from `purpose.consents`. An initial
`cmpuishown` establishes readiness but its transient false values are not
treated as a decision. Unsuccessful, malformed, and duplicate snapshots are
ignored.

A queued CMP stub does not establish `source: "tcf"` merely by returning from
`addEventListener`. Its first callback must report `success === true` before the
absolute deadline. That callback may carry `cmpuishown`, which produces `ready`
with null consent without treating its transient false values as a decision.
Synchronous or asynchronous `success === false` leaves discovery active, and a
silent stub remains pending only until the deadline.

## No CMP

Without a fallback, reaching the deadline emits one replayable `ready` event:

```ts
bridge.on("ready", ({ source, consent }) => {
  // source === "none"
  // consent === null
});
```

`source: "none"` means the bridge found no external consent source. It is not
consent and must not be interpreted as granted or denied.

## Fallback to full libreconsent

The fallback is injected by the host rather than imported by the bridge. This
keeps `@libreconsent/bridge` dependency-free and prevents full core/UI code from
being bundled into bridge-only deployments.

Create and mount the fallback only inside the factory:

```ts
import { init } from "@libreconsent/core";
import { initBridge } from "@libreconsent/bridge";
import { mount } from "@libreconsent/ui";
import { cmpConfig } from "./consent-config";

const bridge = initBridge({
  timeoutMs: 3000,
  fallback: () => {
    const consent = init(cmpConfig);
    mount(consent);
    return consent;
  },
});
```

This is the one-banner rule: while discovery is in progress the bridge renders
nothing; only after timeout does the factory initialize full libreconsent and
allow its UI to appear. If an external CMP is discovered, the factory is never
called. The bridge forwards the fallback's `ready`, `consent`, and `change`
events with `source: "fallback"` and does not emit an intermediate
`source: "none"`.

If the factory throws, the bridge fails closed to one `ready` event with
`source: "none"` and no unhandled asynchronous error.

## Teardown

`reset()` is a read-only teardown operation:

```ts
bridge.reset();
```

It cancels discovery timers, removes the CMP listener when a `listenerId` was
provided, unsubscribes fallback event forwarding, clears the bridge's replay
memory, and releases the singleton so `initBridge()` can be called again.
If a queued CMP supplies its first numeric listener ID only after reset, the
invalidated registration wrapper uses that late ID solely to remove the
external listener. It does not restore bridge state, replay memory, or events.

It deliberately does **not** call the fallback core's destructive `reset()`.
The host owns the fallback API and UI mount handle and must tear those down
separately if needed.

## TCF boundary

libreconsent is not an IAB TCF CMP. The bridge is the only package allowed to
consume `__tcfapi`, and consumption is read-only. In particular it does not:

- expose, assign, or proxy a `__tcfapi` provider;
- expose or decode `tcString`;
- register a CMP ID or claim TCF certification;
- detect, parse, emit, or provide GPP / `__gpp`;
- render or replace the external CMP;
- write cookies or localStorage;
- write `dataLayer`, call `gtag`, or emit Consent Mode updates.

Listener registration and removal follow the current official
[IAB CMP API v2 specification](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md).

## Build and test

```sh
pnpm --filter @libreconsent/bridge build
pnpm --filter @libreconsent/bridge test
```
