# 09 — v1.0.0 Controlled Release Runbook

This runbook is the release boundary for `v1.0.0`. It is intentionally
separate from ordinary CI: all commands before **Irreversible approval** are
local/read-only or write only a caller-chosen external artifact directory.
Nothing in this document authorizes a tag, npm publication, GitHub Release,
deployment, Cloudflare change, or TrackerSync work.

## Current state and prerequisites

- Phase 3D merges before the release commit is tagged. The completed marker in
  `specs/TRACEABILITY.md` remains **Phase 8** until the tag, four publications,
  registry consumer gate, and GitHub Release have all succeeded.
- The release branch is based on the merged Phase 3A, 3B, and 3C PRs:
  [#15](https://github.com/nicolasestrem/libreconsent/pull/15),
  [#16](https://github.com/nicolasestrem/libreconsent/pull/16), and
  [#17](https://github.com/nicolasestrem/libreconsent/pull/17). Their merged
  work is release input, not a claim that a tag or registry package exists.
- The intended npm owner manually signs in with 2FA, creates or claims the
  `libreconsent` organization/scope, requires 2FA for the organization, and
  confirms write access. Do not put credentials, tokens, or one-time codes in
  commands, files, pull requests, issues, or task messages.
- Confirm `main` CI is green and identify the exact 40-character approved SHA.
  The candidate must have no uncommitted or untracked changes and be checked
  out detached. An approval never transfers to a different SHA.
- The release limits are unchanged:

  - No production TCF or GPP implementation.
  - Not a certified AdSense CMP.
  - Decision receipts remain opt-in.
  - Real-domain AdSense bridge interoperability is not yet proven.
  - Exact Safari 15.4 hardware behavior remains unverified.

## Prepare reviewable artifacts

Use a newly created, empty directory outside every Git worktree. The output
must exist before the command and must not have a `.git` ancestor. For example, after
reviewing the approved detached checkout:

```sh
pnpm install --frozen-lockfile
pnpm check
git diff --check
git status --short
pnpm release:prepare -- --expected-sha <40-character-approved-sha> --output <absolute-external-empty-directory>
```

`release:prepare` rejects a non-detached checkout, any tracked or untracked
change, an output directory inside the repository, or a non-empty output
directory. It builds the workspace once, packs each package once with lifecycle
scripts disabled, preserves these exact tarballs in the output directory, and
does not call `npm publish`:

1. `@libreconsent/core`
2. `@libreconsent/ui`
3. `@libreconsent/bridge`
4. `@libreconsent/worker-log`

It also writes `release-manifest.json` and `RELEASE_APPROVAL.md`. They contain
the exact commit, `v1.0.0` tag, SHA-256 and npm integrity for every tarball,
allowlisted file lists, packed/unpacked sizes, package-root exports, the UI
`@libreconsent/core ^1.0.0` peer, approved Phase 3A browser-artifact hashes,
publication order, release notes, and known limits. The JSON candidate
fingerprint covers all of those release inputs. Any commit, tarball, browser
artifact, file list, export, peer, hash, release-note, or known-limit change
invalidates approval and requires a fresh preparation.

## Approval gate

Review the externally stored `RELEASE_APPROVAL.md` and the four preserved
tarballs. The owner must give an explicit irreversible approval that includes
the approval-manifest fingerprint. The required approval sentence is:

> I explicitly approve tagging this SHA as v1.0.0 and publishing exactly these four preserved tarballs in this order.

Without that approval, stop after preparation. A merged PR, a successful dry
run, or prior authorization to merge a PR is not publication authorization.

## Publication sequence — only after irreversible approval

Perform these steps against the exact approved SHA and preserved tarballs; do
not repack directories or replace an artifact:

1. Create an annotated `v1.0.0` tag on the approved SHA and push that tag.
2. Publish the preserved tarballs in order: core, UI, bridge, worker-log.
3. After every package, use the npm registry to verify the exact `1.0.0`
   version and its `dist.integrity` against `release-manifest.json`.
4. Run the registry consumer gate below after core and UI are public.
5. Once the gate passes, create the non-draft GitHub Release from the approved
   release notes. The release tag and notes must match the approval manifest.

The approved release notes must continue to state the known limits, especially
the non-certified AdSense/TCF/GPP boundary and the unproven real-domain bridge
interoperability. Never use credentials or tokens as command arguments.

## Registry consumer gate

Run this only after the approved core and UI packages are publicly available.
The caller supplies a new empty directory outside every Git worktree. The
command installs public registry packages, never workspace links:

```sh
pnpm registry:consumer-gate -- --approval <absolute-external-release-manifest.json> --output <absolute-external-empty-directory>
```

The gate pins both default and `@libreconsent` scope resolution to the public
`https://registry.npmjs.org/` registry before installing exact public core/UI
packages and the bridge browser-artifact package needed for comparison. It
also verifies the generated lockfile's public registry provenance. It verifies
all of the following in
that external directory:

- exact public `@libreconsent/core@1.0.0` and `@libreconsent/ui@1.0.0` registry
  version/integrity;
- strict TypeScript and ESM package-root imports succeed, while runtime and
  type-level deep imports fail;
- the installed head bootstrap synchronously queues all four denied defaults;
- exactly one compatible core installation is present;
- a minimal consumer pinned to Vite `7.0.0` and TypeScript `5.9.3` builds;
- installed core/UI/bridge browser artifacts byte-match the Phase 3A hashes in
  the approved manifest; and
- the built consumer works from a dependency-free ordinary static server in
  Chromium, loading its relative vendor artifact while an obsolete
  `/dist/core.global.js` request returns 404.

The command writes `registry-consumer-evidence.json` beside the preserved
external consumer. TrackerSync Phase 4 must not begin until this gate passes.

## Failure policy

- **Before tagging:** fix the candidate in a new PR, merge it, prepare new
  artifacts and hashes from its clean detached SHA, and obtain fresh approval.
- **After tagging or partial publication:** stop immediately and preserve the
  tag. Do not move, overwrite, casually unpublish, or deprecate `v1.0.0`.
- **Transient registry/authentication failure:** retry only the identical
  preserved tarball after resolving the external condition; do not repack.
- **Content defect after publication:** use a separately approved patch release
  rather than modifying `v1.0.0`.

After tag, all four publications, the registry gate, and GitHub Release have
succeeded, open one tiny documentation-only PR that records the evidence and
advances the completed marker to Phase 9. That follow-up PR, not this one,
closes the release definition of done.
