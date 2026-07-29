# Security policy

libreconsent gates scripts, decides what a browser is allowed to store, and
carries the record of a user's consent decision. A defect here has privacy
consequences beyond the usual, so reports are welcome and taken seriously.

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | Yes |
| < 1.0.0 | No |

Fixes land on the latest 1.x line. There is no backport policy for older
lines yet; if that changes, this table changes with it.

All four packages (`@libreconsent/core`, `@libreconsent/ui`,
`@libreconsent/bridge`, `@libreconsent/worker-log`) are versioned together and
covered by this policy.

## Reporting a vulnerability

Please do not open a public issue, discussion, or pull request for a suspected
vulnerability.

Use GitHub's private vulnerability reporting on this repository:
**Security → Report a vulnerability**
(<https://github.com/nicolasestrem/libreconsent/security/advisories/new>).
The report stays private to you and the maintainer until an advisory is
published.

If that form is unavailable to you, open a public issue that asks for a
private channel and contains **no** details of the vulnerability — not the
affected file, not the trigger, not a proof of concept. The maintainer will
open a private channel from there.

A useful report includes:

- affected package and version, and whether the code is self-hosted from the
  IIFE artifacts or installed from npm;
- integration mode: full (core plus UI), bridge, or worker-log;
- browser and version where relevant;
- the impact you believe it has — what an attacker gains;
- a minimal reproduction, ideally a modified quickstart from
  `examples/quickstarts/`.

## What to expect

This is a single-maintainer project, so the commitments here are deliberately
modest and meant to be kept:

- **Acknowledgement** within 7 days that the report was received and read.
- **Initial assessment** within 14 days: whether it is reproducible, whether
  it is in scope, and a rough severity.
- **Fix and disclosure** coordinated with you. The default is a patch release
  followed by a published GitHub Security Advisory. If a fix will take
  substantially longer, you will be told, with a reason.
- **Credit** in the advisory and the changelog under the name or handle you
  choose, unless you prefer not to be named.

There is no bug bounty.

Please give a reasonable window before public disclosure. If you have not had
a response within 14 days, escalate by opening a public issue that asks for a
maintainer response and still contains no vulnerability details.

## Scope

### In scope

- **Consent state integrity** — anything that lets page code, a third party, or
  another origin read, forge, or alter a stored consent decision, or that
  causes a decision to be recorded as something other than what the user
  chose.
- **Storage or network activity before a decision** — any path that writes a
  cookie, `localStorage`, `sessionStorage`, IndexedDB or Cache API entry, or
  originates a network request, before the user has decided (CORE-8, NFR-3).
- **Gate bypass** — a declaratively gated script, iframe, or placeholder
  (`data-cmp-*`) that executes, loads, or renders without the consent it was
  gated on.
- **Injection through configuration** — any way that a configured string,
  translation, cookie-table value, or selector reaches a DOM sink, a
  script-executing context, or a CSP-relevant attribute.
- **Consent Mode signalling faults** — an ad or analytics signal that is
  granted when the mapped category was not, including through the head
  bootstrap or the US opt-out path.
- **`@libreconsent/worker-log`** — bypass of the receipt endpoint's Origin
  allowlist or host check, bypass of the bearer requirement on receipt
  retrieval, retention or purge that fails to delete, or any path that causes
  the worker or its D1 store to retain an IP address, user agent, request
  header, or other identifier the receipt schema does not include.
- **Supply chain** — anything in a published tarball that should not be there,
  an install script, or an unexpected runtime dependency in a shipped package.

### Not in scope

- **Best-effort dynamic script interception.** `BLK-4` patches
  `HTMLScriptElement.prototype` to neuter blocklisted scripts *before*
  insertion. It cannot cover parser-inserted scripts, dynamically injected
  inline scripts, code that captured the native setter first, or injection
  from another realm. This is documented as KG-1 in
  [specs/07_KNOWN_GAPS.md](specs/07_KNOWN_GAPS.md); declarative gating is the
  guaranteed path. A demonstration that dynamic interception can be evaded is
  a known limitation, not a vulnerability. A failure of *declarative* gating
  is in scope.
- **Withdrawal not un-executing scripts.** Once a script has run it has run;
  withdrawal updates signals and storage immediately and offers the documented
  `reloadOnWithdraw` option (KG-3).
- **Not being a certified TCF CMP.** libreconsent emits no TC string, no GPP
  string, and no CMP ID, by permanent design
  ([specs/NO_TCF.md](specs/NO_TCF.md)). "The library does not signal consent to
  an ad vendor that requires TCF" is expected behavior, not a defect.
- **Compliance opinions.** The shipped EN/FR default texts and example
  configurations are engineering starting points, not legal advice, and have
  had no legal review (KG-10). Disagreement about whether a default is
  GDPR-adequate belongs in a normal issue.
- **The re-prompt after ignoring the banner.** Storing nothing before a
  decision means an undecided visitor sees the banner again (KG-11).
- **Findings against a site's own deployment** — a misconfigured category
  mapping, a weakened CSP, an unrelated third-party tag — unless the library
  caused it.
- Automated scanner output with no demonstrated impact, and reports about
  dev-dependencies that never reach a shipped artifact.

## What the project already does

CI enforces the mechanical half of the security posture on every run: the
source scan in `scripts/guardrails.test.mjs` rejects `eval`, `new Function`,
HTML-sink assignment, `document.write`, unexpected network APIs, any
`__tcfapi` assignment, and any third-party runtime dependency in a shipped
package. Browser fixtures assert pre-decision network silence and a strict CSP
with no `'unsafe-inline'`.

[specs/SECURITY_CHECKLIST.md](specs/SECURITY_CHECKLIST.md) is the maintainer's
internal audit checklist, run when a shipped package changes materially. It is
**not** this policy and is not a disclosure channel — do not file findings
there.
