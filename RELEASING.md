# Releasing libreconsent

Maintainer-facing. `$VERSION` below is the version being released and
`$SHA` its full 40-character commit SHA. The version lives in
`scripts/release-config.mjs` (`RELEASE_VERSION`) and in each package
manifest; bump both, and add the dated `CHANGELOG.md` section, before
preparing anything — `release:prepare` reads its release notes from that
section and refuses a non-empty `[Unreleased]`.

Everything up to and including `release:prepare` is reversible. Everything
after the tag is not.

## 1. Prepare (reversible)

Preparation runs from a detached HEAD at the exact candidate SHA, in a
worktree with no tracked or untracked changes. The output directory must
already exist, be empty, be absolute, and sit outside every Git worktree;
`release:prepare` rejects anything else.

```sh
git checkout --detach $SHA
pnpm install --frozen-lockfile
pnpm check
git status --porcelain=v1 --untracked-files=all   # must print nothing
pnpm release:prepare -- --expected-sha $SHA --output /abs/path/release-out
```

This builds the workspace once, packs each package once with lifecycle
scripts disabled, and preserves those exact tarballs alongside
`release-manifest.json` and `RELEASE_APPROVAL.md`. It never calls
`npm publish`. Review `RELEASE_APPROVAL.md`: commit, tarball SHA-256 and
npm integrity, file lists, package-root exports, UI-to-core peer range,
release notes, known limits. Any change to any of those invalidates the
manifest and requires a fresh preparation.

## 2. Publish (irreversible)

Publish the preserved tarballs. Never repack a directory, never substitute
an artifact, and never pass a credential or one-time code as an argument.

```sh
git tag -a "v$VERSION" -m "libreconsent v$VERSION" $SHA
git push origin "v$VERSION"
```

Publication order is fixed: core, then ui, then bridge, then worker-log.

```sh
cd /abs/path/release-out
npm publish "libreconsent-core-$VERSION.tgz"       --access public
npm publish "libreconsent-ui-$VERSION.tgz"         --access public
npm publish "libreconsent-bridge-$VERSION.tgz"     --access public
npm publish "libreconsent-worker-log-$VERSION.tgz" --access public
```

After each publish, confirm the registry holds the exact version and that
its `dist.integrity` matches the `integrity` recorded for that package in
`release-manifest.json`:

```sh
npm view "@libreconsent/core@$VERSION" --json      # check .dist.integrity
node -e 'const m=require("./release-manifest.json");
  for (const p of m.packages) console.log(p.name, p.integrity)'
```

Once all four packages are public, run the consumer gate into a second
empty absolute directory outside every Git worktree. The gate resolves
core, ui **and** bridge from the registry, so it cannot run before bridge
is published. It installs from `https://registry.npmjs.org/` only, never
from workspace links, and writes `registry-consumer-evidence.json`.

Run it from the repository, not from the artifact directory the publish
step left you in:

```sh
cd /path/to/libreconsent
pnpm registry:consumer-gate -- \
  --approval /abs/path/release-out/release-manifest.json \
  --output /abs/path/consumer-out
```

Create the GitHub Release only after that gate passes, from the approved
notes. They must keep stating the known limits, in particular the
non-certified AdSense/TCF/GPP boundary (`specs/NO_TCF.md`) and the unproven
real-domain bridge interoperability (`specs/07_KNOWN_GAPS.md`).

```sh
NOTES=/abs/path/release-out/RELEASE_NOTES.md
node -e 'const m = require("/abs/path/release-out/release-manifest.json");
  process.stdout.write(m.releaseNotes + "\n")' > "$NOTES"
gh release create "v$VERSION" --title "v$VERSION" --notes-file "$NOTES"
```

## 3. Failure policy

- **Before tagging:** fix the candidate in a new pull request, merge it,
  and prepare fresh artifacts from the new clean detached SHA. Approval
  never transfers between SHAs.
- **After tagging or partial publication:** stop and preserve the tag. Do
  not move it, overwrite a published version, unpublish, or deprecate to
  tidy up.
- **Transient registry or authentication failure:** retry the identical
  preserved tarball once the external condition is resolved. Do not repack.
- **Content defect discovered after publication:** ship a patch release.
  Never modify a published version.
