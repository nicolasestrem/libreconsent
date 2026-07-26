# libreconsent — instructions for Claude Code

Read specs/03_MASTER_PRODUCTION_SPEC.md before any change.
Work one phase at a time (spec §12). Current phase: see specs/08_CHANGELOG_AI.md.

## Hard rules
- NEVER add TCF support: no TC string emission, no __tcfapi provider, no CMP ID.
  Read-only __tcfapi consumption in packages/bridge is the only exception. (G-1)
- Zero runtime dependencies in core/ui/bridge. (G-2)
- Size budgets are hard CI failures — run `pnpm size` before committing. (G-3)
- Nothing is stored client-side before a user decision. (CORE-8)
- No eval / new Function / innerHTML with config strings. (G-6)
- Every requirement implemented gets a test and a row in specs/TRACEABILITY.md.
- For Google-specific behavior (consent mode, RDP): fetch current Google docs at
  implementation time; cite source + date in the PR description. (CM-6, US-4)
- After each phase: fill specs/05_BUILD_REVIEW.md, log patches in
  specs/06_PATCH_PLAN.md, append to specs/08_CHANGELOG_AI.md.

## Commands
pnpm install · pnpm build · pnpm test · pnpm e2e · pnpm size · pnpm lint · pnpm check

## Conventions
TypeScript strict; ESM source; tsup builds ESM+IIFE; conventional commits;
public API only from package roots; TSDoc on all exports.