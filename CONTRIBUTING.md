# Contributing to libreconsent

Thanks for considering a contribution. libreconsent is a consent-mode-first,
self-hosted consent library with no third-party runtime dependencies, and it
holds a few constraints that are stricter than most TypeScript projects. This
document describes the toolchain, the gates, and the rules that are easy to
violate by accident.

## Before you start

Open an issue before writing a large change. Small fixes, documentation
corrections, and test additions can go straight to a pull request.

Two categories of proposal will be declined regardless of implementation
quality; both are explained under [project rules](#project-rules):

- anything that emits an IAB TCF or GPP string, provides `__tcfapi`, or claims
  a CMP ID;
- anything that adds a third-party runtime dependency to `@libreconsent/core`,
  `@libreconsent/ui`, or `@libreconsent/bridge`.

## Development setup

Requirements:

- Node.js `>=24` (the repository pins `24` in `.nvmrc`)
- pnpm `>=11`; the exact version is pinned by `packageManager`
  (`pnpm@11.15.1`). Corepack will select it for you.

```sh
git clone https://github.com/nicolasestrem/libreconsent.git
cd libreconsent
pnpm install
pnpm build
```

Browser tests need Playwright's Chromium:

```sh
pnpm exec playwright install --with-deps chromium
```

To look at the library running, serve the bundled examples:

```sh
pnpm build
pnpm examples:serve
```

`pnpm quickstarts:serve` does the same for the four static quickstarts under
`examples/quickstarts/`, using an ordinary static server with no rewrites, so
what you see is what a deployment sees.

## The gates

CI runs one job that executes every gate in order. `pnpm check` is that same
chain, and it is the command to run before opening a pull request:

```sh
pnpm check
```

The eleven gates, in the order they run:

| Gate | Command | What it enforces |
|---|---|---|
| Workflow supply-chain guardrails | `pnpm workflows:check` | Remote actions pinned to full commit SHAs, `actions/checkout` without credential persistence |
| Traceability | `pnpm traceability` | Exactly one non-empty, test-backed row per requirement in `specs/TRACEABILITY.md` |
| Typecheck | `pnpm typecheck` | `tsc --noEmit` across the workspace plus the worker package |
| Lint | `pnpm lint` | `biome check .` (formatting and lint in one pass) |
| Unit tests | `pnpm test` | Vitest for the browser packages, the Workers pool for `worker-log`, and the source guardrail scan |
| Build | `pnpm build` | tsup ESM + IIFE builds for every package |
| Size budgets | `pnpm size` | The hard byte ceilings in `.size-limit.cjs` |
| Release audit | `pnpm release:check` | Strict tarball contents, export maps, quickstart asset freshness |
| Static quickstart portability | `pnpm quickstarts:portability` | The quickstarts work from a plain static server |
| E2E tests | `pnpm e2e` | Chromium behavior fixtures, including pre-decision network silence |
| Accessibility tests | `pnpm a11y` | axe-core over the banner, preferences, and opt-out surfaces |

Individual gates are fine to run on their own while iterating. `pnpm check` is
slow because it builds and drives a browser; run it once before you push
rather than on every save.

None of these gates publish, tag, deploy, or contact a real vendor. The
examples and quickstarts use local stand-ins for vendor loaders precisely so
the test suite makes no third-party request.

## Project rules

These are the constraints a new contributor is most likely to break. They are
part of the specification, not preferences, and CI enforces most of them.

### No TCF, ever

libreconsent never emits a TC string, never provides a `__tcfapi`, and never
claims a CMP ID. This is permanent and is not open for discussion, so please
do not open a pull request or an issue proposing it.

The reason is economics rather than engineering. A valid TC string carries a
CMP ID from the paid IAB registry, and certification plus recurring
recertification places deployment responsibility on the registered CMP owner.
A freely forkable, self-hosted library cannot issue or inherit a certified CMP
identity — every fork would be trading on someone else's registration. Sites
that need certified TCF consent should put a certified CMP in front of their
ad tags; libreconsent targets the cases that do not.

The one exception: `@libreconsent/bridge` *reads* an external CMP's `__tcfapi`
to expose a consistent, read-only application API. It never provides that API,
never writes external CMP storage, and never sends consent signals.

See [specs/NO_TCF.md](specs/NO_TCF.md) for the full policy.

### Zero third-party runtime dependencies

`core`, `ui`, and `bridge` ship with no third-party runtime dependency and no
install scripts. `@libreconsent/ui` declaring `@libreconsent/core` as a peer is
the only permitted package relationship. `@libreconsent/worker-log` has no
runtime dependency either; Wrangler and the Workers types are root
dev-dependencies.

Dev-dependencies are negotiable, but each one is reviewed. Adding one changes
`pnpm-lock.yaml`, so call it out in the pull request description.

### Size budgets are hard failures

`.size-limit.cjs` caps the gzipped IIFE artifacts: core at 12 kB, core plus UI
combined at 19 kB, bridge at 4 kB, and the synchronous head snippet at 1.5 kB.
Run `pnpm size` locally. Raising a budget requires measurement evidence and a
new entry in `specs/DECISION_LOG.md`; it is not something a feature pull
request does in passing.

### Nothing is stored before a decision

No cookie, no `localStorage` key, no `sessionStorage` key, no IndexedDB entry,
and no "banner was shown" flag may be written before the user makes a choice.
The US implied-grant and GPC state stay in memory and are recomputed on every
load. There is a dedicated test for this, and an E2E fixture that asserts the
page contacts no Google endpoint before a decision.

A visible consequence is that a visitor who ignores the banner sees it again
on the next page load. That is correct under ePrivacy and is recorded as an
accepted limitation (KG-11); please do not "fix" it.

### No dynamic code, no HTML sinks

No `eval`, no `new Function`, no assignment to `innerHTML`, `outerHTML`, or
`insertAdjacentHTML`, and no `document.write` in the shipped browser sources.
Configured text reaches the DOM through `textContent` only. The source scan in
`scripts/guardrails.test.mjs` fails the unit-test gate if any of these appear.

The UI must also keep working under a strict CSP without `'unsafe-inline'`;
`examples/csp-site` is the fixture that proves it.

### Every requirement gets a test and a traceability row

`specs/TRACEABILITY.md` is a table with one row per requirement ID, and
`pnpm traceability` rejects a missing row, a duplicate row, a reference to a
file that does not exist, and evidence that is not a real test. The shape is:

```text
| REQ-ID | `impl/file.ts`; `impl/other.ts` | `packages/core/src/index.test.ts` — `the test name` | Passing |
```

Rules the checker enforces:

- The requirement ID matches a known ID (`CORE-4`, `BLK-2`, `UI-7`, and so on).
- Implementation and verification cells each contain at least one backticked
  repository path that exists.
- Verification paths must be runnable tests — `packages/*/src/*.test.ts`,
  `scripts/*.test.mjs`, `tests/*.e2e.spec.ts`, or `tests/*.a11y.spec.ts` — or
  `.github/workflows/ci.yml` together with a named CI check such as
  `` `Build` `` or `` `Size budgets` ``.
- Status is conventionally `Passing`.

If you change behavior covered by an existing requirement, update that row's
evidence. If you add behavior that is not covered by any requirement, say so
in the pull request; a new requirement ID is a specification change and needs
discussion first.

### Google-specific behavior is researched, not remembered

Google's consent mode and restricted-data-processing documentation drifts, and
the specification's own source URLs have 404'd before. Any change to
Google-specific behavior must fetch the current Google documentation at
implementation time and cite the source URL plus the retrieval date in the
pull request description. This is requirement CM-6 / US-4.

### Code conventions

- TypeScript in `strict` mode. No `any` escape hatches in shipped sources.
- ESM sources; tsup produces ESM and IIFE builds.
- Public API is exported from package roots only. Deep module imports are
  unsupported and blocked by the package export maps — the release audit
  checks this.
- TSDoc on every export.
- Formatting is Biome's: two-space indent, double quotes, semicolons. Run
  `pnpm lint` and let Biome decide.
- Markdown is hand-wrapped at roughly 79 columns. Nothing lints it, so match
  the file you are editing.

## Commits and pull requests

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org).
A scope is usual and names the package or area:

```text
feat(core): support fixed-denied Consent Mode signals
fix(ci): close workflow guardrail bypasses
docs: record v1.0.0 release evidence
chore(test): remove cross-browser release matrix
```

Common types in this repository: `feat`, `fix`, `docs`, `chore`, `ci`, `test`,
`refactor`.

For the pull request itself:

- One logical change per pull request. Keep unrelated formatting out of it.
- Fill in `.github/PULL_REQUEST_TEMPLATE.md`; the checklist is the same set of
  gates CI runs.
- Add or update `CHANGELOG.md` for anything user-visible.
- Update the relevant package README when you change public API.
- Paste the evidence you have: which gates you ran, and any Google source you
  cited.

## Maintainer notes

When a browser artifact changes, the mirrored copies under
`examples/vendor/libreconsent/` and the inline head-bootstrap copies embedded
in the quickstart pages go stale. Refresh them and commit the result:

```sh
pnpm build
pnpm quickstarts:sync-assets
```

The release audit (`pnpm release:check`, and therefore `pnpm check` and CI)
fails if either the mirrors or the inline head copies are out of date.

## Known limitations

Before reporting a bug, check [specs/07_KNOWN_GAPS.md](specs/07_KNOWN_GAPS.md).
Several behaviors that look like defects are accepted limitations with
recorded reasoning — notably best-effort dynamic script interception (KG-1),
the fact that withdrawal cannot un-execute scripts that already ran (KG-3),
and the re-prompt that follows from storing nothing before a decision (KG-11).

## Security

Do not report vulnerabilities through public issues or pull requests. See
[SECURITY.md](SECURITY.md).

## How this project was built

libreconsent was built specification-first with AI assistance: the requirements
in `specs/` were written before the code, and each one is traced to a named
test in [specs/TRACEABILITY.md](specs/TRACEABILITY.md) that CI verifies on
every run. Review the behavior and the tests rather than the provenance.

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Contributions are accepted under the [MIT License](LICENSE) that covers the
rest of the repository.
