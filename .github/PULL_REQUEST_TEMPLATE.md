## Summary

<!-- What changes, and why. One logical change per pull request. -->

## Linked issue

<!-- Closes #123, or "none" for a self-contained fix. -->

## Type of change

- [ ] Bug fix
- [ ] New behavior
- [ ] Breaking change to public API
- [ ] Documentation, examples, or quickstarts
- [ ] Build, CI, or tooling

## Verification

- [ ] `pnpm check` passes locally (all eleven gates)
- [ ] Tests added or updated for the changed behavior
- [ ] `specs/TRACEABILITY.md` row added or updated if a requirement was
      implemented or its evidence moved
- [ ] `CHANGELOG.md` updated for anything user-visible
- [ ] Size budgets respected (`pnpm size`); no budget was raised
- [ ] No new third-party runtime dependency in `core`, `ui`, `bridge`, or
      `worker-log`
- [ ] No TCF or GPP surface added — no TC string, no `__tcfapi` provider, no
      CMP ID
- [ ] Nothing is stored client-side before a user decision
- [ ] Package README updated if public API changed

## Google documentation

Changes to Google-specific behavior (Consent Mode, restricted data
processing, GTM ordering) must cite the current Google documentation fetched
at implementation time, with the retrieval date (CM-6 / US-4). Write "not
applicable" otherwise.

<!--
- <title> — <url> — retrieved YYYY-MM-DD
-->

## Notes for reviewers

<!-- Trade-offs, alternatives considered, anything worth a second look. -->
