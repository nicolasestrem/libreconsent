# libreconsent — contributor and agent instructions

Read specs/03_MASTER_PRODUCTION_SPEC.md before any change. The requirement IDs
(CFG-*, CORE-*, CM-*, BLK-*, UI-*, US-*, BR-*, LOG-*, NFR-*) and the global
guardrails G-1..G-6 are defined there.

## Hard rules
- NEVER add TCF support: no TC string emission, no __tcfapi provider, no CMP ID.
  Read-only __tcfapi consumption in packages/bridge is the only exception. (G-1)
- Zero third-party runtime dependencies in core/ui/bridge; UI may require core
  as its sole first-party peer. (G-2)
- Size budgets are hard CI failures — run `pnpm size` before committing. (G-3)
- Nothing is stored client-side before a user decision. (CORE-8, G-4)
- Every user-facing string comes from the i18n layer. (CFG-7, G-5)
- No eval / new Function / innerHTML with config strings. (G-6)
- Every requirement implemented gets a test and a row in specs/TRACEABILITY.md.
- For Google-specific behavior (consent mode, RDP): fetch current Google docs at
  implementation time; cite source + date in the PR description. (CM-6, US-4)
- Record manual checklist runs (specs/A11Y_CHECKLIST.md,
  specs/SECURITY_CHECKLIST.md) in the PR description.
- Update CHANGELOG.md. Releases follow RELEASING.md.

## Commands
pnpm install · pnpm build · pnpm test · pnpm e2e · pnpm size · pnpm lint · pnpm check

## Conventions
TypeScript strict; ESM source; tsup builds ESM+IIFE; conventional commits;
public API only from package roots; TSDoc on all exports.
