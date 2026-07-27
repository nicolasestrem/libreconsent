# US_NOTES — US state privacy research record (US-4)

## 1. Purpose and scope

This file is the US-4 research-at-implementation record for the Phase 6 US module, covering
restricted data processing (RDP), Consent Mode v2 and Global Privacy Control (GPC).

These are **engineering notes, not legal advice.** They record what the cited documents say on
the retrieval date and what libreconsent therefore does. As with KG-10, the site owner is
responsible for their own compliance posture: the region list they configure, the notice texts
they ship, the category mapping they choose, and whether the behavior described here is
adequate for the laws that apply to them. US state privacy law is a moving target (KG-8) and
this record will go stale; re-run it before changing US behavior.

## 2. Sources consulted

All retrieved 2026-07-27.

| Document title | URL | What it establishes |
|---|---|---|
| Set up consent mode on websites (page states "Last updated 2026-05-06 UTC") | https://developers.google.com/tag-platform/security/guides/consent | The four v2 signals and their semantics; `ads_data_redaction` and `url_passthrough` as `gtag('set', ...)` settings; region-specific defaults with most-specific-region precedence |
| Helping advertisers comply with the U.S. states' privacy laws in Google Ads | https://support.google.com/google-ads/answer/9614122 | What RDP is and which products need action to enable it; that Google receives GPC directly and triggers RDP itself in applicable states; that sending an RDP parameter on GPC is a partner option, not a requirement |
| Disable the collection of personalized advertising data | https://support.google.com/google-ads/answer/9606827 | The advertiser-side RDP controls: the `restricted_data_processing` parameter on `gtag('config', ...)`, the Audience Manager checkbox, the Tag Manager field, and `rdp=1` for server-to-server requests |
| Helping publishers comply with U.S. states privacy laws (Ad Manager) | https://support.google.com/admanager/answer/9561023 | Publisher-side RDP: enabled through a CMP passing IAB GPP/US Privacy strings, or per-request through publisher ad tags |
| Restricted data processing settings in Google's publisher ad tags | https://support.google.com/adsense/answer/9598414 | The publisher-side per-request RDP APIs: `googletag.pubads().setPrivacySettings({'restrictDataProcessing': true})`, `data-restrict-data-processing="1"`, and the `&rdp=1` request parameter |
| Global Privacy Control (GPC), W3C Editor's Draft, 11 June 2026, W3C Privacy Working Group | https://w3c.github.io/gpc/ | `navigator.globalPrivacyControl` as a readonly boolean; the `Sec-GPC: 1` header; per-navigation caching; the signal's intended legal meaning and its interaction with choices made directly with the publisher |
| Cal. Code Regs. tit. 11, § 7025 — Opt-Out Preference Signals | https://www.law.cornell.edu/regulations/california/11-CCR-7025 | That a conforming signal must be treated as a valid opt-out of sale/sharing, and the conditions under which a business may act on a consumer's contrary consent |
| Universal Opt-Out and the Colorado Privacy Act (Colorado Department of Law) | https://coag.gov/opt-out/ | That GPC is the only UOOM the Department currently recognizes, and that recognition has been mandatory for in-scope controllers since 1 July 2024 |
| _(start URL from the spec, could not be retrieved)_ | https://support.google.com/adsense/answer/9561024 | **Returns HTTP 404, "this page can't be found."** The AdSense/Ad Manager US-states guidance now lives at the Ad Manager and AdSense URLs cited above; the spec's start URL should be updated |

The GPC specification has also moved. `https://globalprivacycontrol.github.io/gpc-spec/` is a
dead GitHub Pages host; `https://privacycg.github.io/gpc-spec/` (the URL the Colorado AG still
links) redirects to `https://w3c.github.io/gpc/`, which is the current editor's draft and the
URL recorded above.

## 3. Google restricted data processing (RDP)

RDP is a contractual and account-level processing mode, not a consent signal. With RDP active,
Google limits its use of identifiers and other data to a fixed list of activities (ad delivery,
debugging, improving and developing, reporting and measurement, security and fraud detection),
and acts as the site owner's service provider under the US State Privacy Laws Addendum. Some
products run under RDP unconditionally; others require the site owner to switch it on.

Where action is required, every documented mechanism sits outside a consent library's reach:

- **Account level** — a checkbox in Google Ads Audience Manager that enables RDP for all users
  in applicable US states, and equivalent settings in Ad Manager and AdSense.
- **Tag configuration level** — the `restricted_data_processing` parameter on the Google Ads
  tag's `gtag('config', 'TAG_ID', { 'restricted_data_processing': true })` call, or the
  "Enable Restricted Data Processing" field on the Google Ads tags in Tag Manager.
- **Ad request level (publishers)** — `googletag.pubads().setPrivacySettings(...)`, the
  `data-restrict-data-processing` attribute on an AdSense/Ad Exchange `<ins>` slot, or `rdp=1`
  on a tagless request.
- **CMP level (publishers)** — passing an IAB GPP or US Privacy string, which Ad Manager reads
  and converts into RDP. libreconsent emits neither string.

**Verdict: (A) documentation-only.** Nothing in the live documentation asks a consent library
to set `ads_data_redaction`, or any other flag, dynamically when a US or GPC opt-out occurs.
Three findings support this:

1. `ads_data_redaction` is not an RDP control at all. It is a Consent Mode setting that takes
   effect only while `ad_storage` is denied, and it redacts ad click identifiers in Google Ads
   and Floodlight network requests. Google documents it as a `gtag('set', ...)` call placed in
   the head before any configuration command — which is exactly where libreconsent already
   emits it (`packages/core/src/head-bootstrap.ts:142-144`, gated on `adsDataRedaction`). The
   RDP parameters are separately named (`restricted_data_processing`, `restrictDataProcessing`,
   `rdp`) and belong to the ad tags, not to the consent-mode surface.
2. Google states that it receives GPC signals directly and activates RDP for those ad requests
   itself in applicable states. Publishers who have implemented GPC "may choose" to also send
   an RDP parameter. That is permissive, not required.
3. Enabling RDP is a decision about the site owner's contractual posture with Google and about
   tags libreconsent does not own; silently flipping it would make that decision for them.

The correct and sufficient library behavior on a US opt-out is therefore to deny the three ad
signals through the existing `ConsentModeAdapter` (`packages/core/src/consent-mode.ts`), which
already sends a `gtag('consent', 'update', ...)` on every decision and withdrawal. Site owners
who want RDP as well should enable it at the account level, or wire one of the tag-level
parameters above to libreconsent's `change` event in their own code. That belongs in the
README as documentation, not in the core.

## 4. Consent Mode v2 signals relevant to a US opt-out

The current guide confirms the four signal names and semantics unchanged: `ad_storage`,
`ad_user_data` (consent for sending advertising-related user data to Google),
`ad_personalization` (consent for personalized advertising) and `analytics_storage`. Values are
`'granted'` or `'denied'`; `wait_for_update` and a `region` array are accepted on `default`
commands, with the most specific region winning.

A sale/share opt-out denies the categories mapped from `ad_storage`, `ad_user_data` and
`ad_personalization`. These are the three signals that correspond to what the US statutes call
sale, share, and cross-context behavioral or targeted advertising, and they are what GPC is
defined to opt the user out of.

`analytics_storage` is deliberately **not** denied. GPC is a do-not-sell-or-share signal; the
specification is explicit that it is not intended to limit a first party's use of personal
information within the same context, and is not designed to exercise every privacy right.
First-party analytics is that same-context use. Site owners who take a stricter view can map
`analytics_storage` to a category their US opt-out denies — the mapping is configuration.

Google documents no US-specific or GPC-specific behavior in Consent Mode itself. Consent Mode's
region parameter is about where defaults apply, not about opt-out semantics; there is no
US-only signal and no GPC-derived value.

## 5. Global Privacy Control

The JavaScript surface is `navigator.globalPrivacyControl`, a readonly boolean, available on
`navigator` in both window and worker contexts. The value is `true` only when a `Sec-GPC`
header would be sent; the header's only valid field value is the single character `1`. The
specification requires the preference to be cached per top-level navigation (`gpcAtNavigation`),
so a mid-session change of the browser setting is not visible until the next navigation.

The signal means the person is requesting that their data not be sold to or shared with any
party other than the one they intend to interact with, and not be used for cross-context ad
targeting. Several US states, including Colorado, recognize GPC as a valid universal opt-out
mechanism; in Colorado it is currently the only one the Department recognizes.

libreconsent reads the property on each page load and derives the opt-out in memory only. The
GPC-applied state is never written to the consent cookie or to any other client-side storage,
which also keeps it inside CORE-8: nothing is stored before a user decision, and GPC is not a
user decision made with this site. Because the browser re-asserts the signal on every
navigation and the specification caches it per navigation, re-deriving per load is the
behavior that matches the signal, not a shortcut.

## 6. GPC versus a stored explicit decision

**The rule we implement: an active stored decision wins; GPC applies only when no active stored
decision exists.** A visitor who has explicitly chosen on this site keeps that choice for the
life of the cookie. Because the GPC-derived state is never persisted, it can never masquerade
as a stored decision, and the moment a stored decision expires or is withdrawn, GPC is honored
again on the next load with no further user action.

The regulatory reasoning is that both frameworks contemplate a person's specific, later consent
overriding a general signal. § 7025(c)(3) provides that where an opt-out preference signal
conflicts with a business-specific privacy setting permitting sale or sharing, the business may
notify the consumer of the conflict, offer an opportunity to consent under § 7004, and — if the
consumer consents — may then ignore the signal for as long as the consumer is known to it.
Colorado's rules likewise treat the browser and consumer as opted out until the consumer
consents. The GPC specification itself anticipates this, noting that jurisdictions differ on
when a business may override a signal, for example because it has consent, and asking
publishers to disclose how they resolve conflicts between the signal and choices the person has
already made directly with them.

**Two caveats a site owner should read before relying on this.** First, § 7025(c)(3) frames the
override as available *after* the business processes the signal and notifies the consumer of
the conflict; it is not a blanket rule that any pre-existing stored preference outranks a later
signal. Our precedence rule is on firmest ground where the stored decision is a genuine,
informed choice the visitor made on this site, and site owners with California traffic should
consider surfacing the conflict and the opt-out status rather than staying silent. Second,
§ 7025(c)(5) prohibits reading the *absence* of a signal as opt-in consent — libreconsent does
not do this, because absence of GPC produces no state change at all, only the implied grant
that US opt-out regions already carry. Both points are the kind of conflict handling the GPC
specification asks publishers to disclose, so they belong in user-facing docs, not only here.

## 7. Region model

`usPrivacy.regions` defaults to `["US"]`. Matching is prefix-aware on the ISO 3166-2 style codes
Consent Mode already uses, so a configured `"US"` matches a resolved `"US-CA"`, while a
configured `"US-CA"` matches only California. This mirrors Google's own most-specific-region
precedence for consent defaults and lets EU opt-in and US opt-out coexist in one configuration
(US-3).

An unresolved region never counts as US. Per CFG-9 and KG-4 the library has no built-in
geolocation and depends on a site-supplied signal; when that signal is missing, the strictest
behavior applies rather than the opt-out path. In practice this means an unresolved visitor
does not receive the US implied grant.

## 8. Testing caveat

Playwright 1.62 has no native GPC browser-context option. Our E2E coverage simulates the signal
two ways at once: `extraHTTPHeaders` sets `Sec-GPC: 1` on requests, and an init script defines
`navigator.globalPrivacyControl` as `true` before page scripts run. This exercises our detection
and the resulting consent-mode updates, but it does not exercise a real GPC-enabled browser
build, and it cannot exercise the specification's per-navigation caching semantics. Behavior
with a genuine GPC browser or extension is therefore not verified in CI.

## 9. Open questions and watch items

Feed for KG-8 (US state privacy laws are a moving target):

- **Google's start URL for AdSense US-states guidance 404s.** The spec's US-4 pointer
  (`adsense/answer/9561024`) is dead; update it to the Ad Manager and AdSense pages cited above.
- **RDP as an opt-in integration.** If site owners ask for it, the smallest honest addition is
  documentation showing how to set `restricted_data_processing` or `restrictDataProcessing` from
  a `change` listener. Adding it to core would put libreconsent in the position of deciding the
  site owner's contractual posture with Google.
- **IAB GPP / US Privacy strings are out of scope.** Google reads them for publisher-side RDP,
  and the IAB deprecated the US Privacy string in January 2024 in favor of GPP. libreconsent
  emits neither. Sites that need Ad Manager to see a US opt-out through a string, rather than
  through Google's direct GPC handling, need something else in front of their ad tags.
- **The § 7025(c)(3) conflict-notification question in section 6** deserves review by counsel
  for any site with substantial California traffic, and may argue for a UI affordance that
  surfaces the conflict.
- **Recognized UOOM lists change.** Colorado recognizes only GPC today and updates its list
  periodically; other states may designate additional mechanisms. Re-check before widening.
