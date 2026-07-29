// SPDX-License-Identifier: MIT
/**
 * The renderer stylesheet.
 *
 * Every visual value resolves through a `--libreconsent-*` custom property so
 * hosts theme the UI without overriding selectors (UI-4). Nothing here loads an
 * external asset. Layout uses logical properties throughout so a right-to-left
 * document mirrors structurally without a second stylesheet (UI-8).
 *
 * Accept and reject share `.lc-btn--primary`: equal prominence is a property of
 * the markup rather than a rule a theme could accidentally undo (UI-1, UI-7).
 */
export const styles = `
.lc-root {
  --lc-bg: var(--libreconsent-bg, #ffffff);
  --lc-fg: var(--libreconsent-fg, #16181d);
  --lc-muted: var(--libreconsent-muted, #565b66);
  --lc-surface: var(--libreconsent-surface, #f5f6f8);
  --lc-border: var(--libreconsent-border, #d5d8de);
  --lc-accent: var(--libreconsent-accent, #1b57d6);
  --lc-accent-fg: var(--libreconsent-accent-fg, #ffffff);
  --lc-overlay: var(--libreconsent-overlay, rgba(16, 18, 23, 0.55));
  --lc-focus: var(--libreconsent-focus, #1b57d6);
  --lc-radius: var(--libreconsent-radius, 8px);
  --lc-space: var(--libreconsent-space, 1rem);
  --lc-z: var(--libreconsent-z-index, 2147483000);
  --lc-font: var(--libreconsent-font-family, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  --lc-max: var(--libreconsent-max-width, 64rem);
  --lc-fab-inset: var(--libreconsent-fab-inset, var(--lc-space));
}
@media (prefers-color-scheme: dark) {
  .lc-root {
    --lc-bg: var(--libreconsent-bg, #16181d);
    --lc-fg: var(--libreconsent-fg, #f2f3f5);
    --lc-muted: var(--libreconsent-muted, #a8adb8);
    --lc-surface: var(--libreconsent-surface, #1e2128);
    --lc-border: var(--libreconsent-border, #343841);
    --lc-accent: var(--libreconsent-accent, #6f9bff);
    --lc-accent-fg: var(--libreconsent-accent-fg, #10131a);
    --lc-overlay: var(--libreconsent-overlay, rgba(0, 0, 0, 0.65));
    --lc-focus: var(--libreconsent-focus, #8fb2ff);
  }
}
.lc-root[data-lc-theme="light"] {
  --lc-bg: var(--libreconsent-bg, #ffffff);
  --lc-fg: var(--libreconsent-fg, #16181d);
  --lc-muted: var(--libreconsent-muted, #565b66);
  --lc-surface: var(--libreconsent-surface, #f5f6f8);
  --lc-border: var(--libreconsent-border, #d5d8de);
  --lc-accent: var(--libreconsent-accent, #1b57d6);
  --lc-accent-fg: var(--libreconsent-accent-fg, #ffffff);
  --lc-overlay: var(--libreconsent-overlay, rgba(16, 18, 23, 0.55));
  --lc-focus: var(--libreconsent-focus, #1b57d6);
}
.lc-root[data-lc-theme="dark"] {
  --lc-bg: var(--libreconsent-bg, #16181d);
  --lc-fg: var(--libreconsent-fg, #f2f3f5);
  --lc-muted: var(--libreconsent-muted, #a8adb8);
  --lc-surface: var(--libreconsent-surface, #1e2128);
  --lc-border: var(--libreconsent-border, #343841);
  --lc-accent: var(--libreconsent-accent, #6f9bff);
  --lc-accent-fg: var(--libreconsent-accent-fg, #10131a);
  --lc-overlay: var(--libreconsent-overlay, rgba(0, 0, 0, 0.65));
  --lc-focus: var(--libreconsent-focus, #8fb2ff);
}
.lc-root, .lc-root *, .lc-root *::before, .lc-root *::after { box-sizing: border-box; }
/* Zero-specificity reset: :where() keeps every component rule below able to win
   regardless of source order, which is what protects equal prominence. */
:where(.lc-root) :where(h2, h3, p, ul, li, table, button, th, td) {
  margin: 0; padding: 0; border: 0; font: inherit; color: inherit;
  text-align: start; background: none; list-style: none;
}
.lc-root {
  font-family: var(--lc-font);
  font-size: var(--libreconsent-font-size, 0.9375rem);
  line-height: 1.5;
  color: var(--lc-fg);
}
.lc-root :focus-visible { outline: 2px solid var(--lc-focus); outline-offset: 2px; }
.lc-surface {
  background: var(--lc-bg);
  color: var(--lc-fg);
  border: 1px solid var(--lc-border);
  box-shadow: var(--libreconsent-shadow, 0 6px 28px rgba(0, 0, 0, 0.18));
}
.lc-banner {
  position: fixed;
  z-index: var(--lc-z);
  padding: var(--lc-space);
  display: flex;
}
.lc-banner[data-layout="bar-bottom"] {
  inset-inline: 0;
  inset-block-end: 0;
  border-inline-width: 0;
  border-block-end-width: 0;
}
.lc-banner[data-layout="box"] {
  inset-block-end: var(--lc-space);
  inset-inline-start: var(--lc-space);
  max-inline-size: 26rem;
  border-radius: var(--lc-radius);
}
.lc-banner[data-layout="modal"] {
  position: static;
  max-inline-size: 32rem;
  inline-size: 100%;
  border-radius: var(--lc-radius);
}
.lc-copy { flex: 1 1 20rem; min-inline-size: 0; }
.lc-inner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lc-space);
  align-items: center;
  justify-content: space-between;
  inline-size: 100%;
}
.lc-banner[data-layout="bar-bottom"] .lc-inner {
  max-inline-size: var(--lc-max);
  margin-inline: auto;
}
.lc-banner[data-layout="box"] .lc-inner,
.lc-banner[data-layout="modal"] .lc-inner {
  flex-direction: column;
  align-items: stretch;
}
.lc-title { font-size: 1.0625rem; font-weight: 600; }
.lc-text { color: var(--lc-muted); margin-block-start: 0.25rem; }
.lc-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.lc-btn {
  cursor: pointer;
  border-radius: var(--lc-radius);
  padding: 0.625rem 1.125rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border: 1px solid transparent;
  min-inline-size: 8.5rem;
  text-align: center;
  justify-content: center;
}
.lc-btn--primary { background: var(--lc-accent); color: var(--lc-accent-fg); }
.lc-btn--ghost {
  background: transparent;
  color: var(--lc-fg);
  border-color: var(--lc-border);
}
.lc-btn--link {
  background: transparent;
  color: var(--lc-fg);
  border-color: transparent;
  text-decoration: underline;
  min-inline-size: auto;
}
.lc-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--lc-z);
  background: var(--lc-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--lc-space);
  overflow: auto;
}
.lc-modal {
  inline-size: 100%;
  max-inline-size: 40rem;
  max-block-size: 100%;
  border-radius: var(--lc-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.lc-modal--narrow { max-inline-size: 28rem; }
.lc-modal-head {
  display: flex;
  gap: var(--lc-space);
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--lc-space);
  border-block-end: 1px solid var(--lc-border);
}
.lc-modal-body { padding: var(--lc-space); overflow: auto; display: grid; gap: var(--lc-space); }
.lc-modal-foot {
  padding: var(--lc-space);
  border-block-start: 1px solid var(--lc-border);
  background: var(--lc-surface);
}
.lc-close {
  cursor: pointer;
  border-radius: var(--lc-radius);
  padding: 0.25rem 0.5rem;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--lc-muted);
  flex: none;
}
.lc-group { border: 1px solid var(--lc-border); border-radius: var(--lc-radius); padding: 0.875rem; }
.lc-group-head { display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; }
.lc-group-title { font-size: 1rem; font-weight: 600; }
.lc-group-desc { color: var(--lc-muted); font-size: 0.875rem; margin-block-start: 0.25rem; }
.lc-badge {
  color: var(--lc-muted);
  font-size: 0.8125rem;
  background: var(--lc-surface);
  border: 1px solid var(--lc-border);
  border-radius: 999px;
  padding: 0.125rem 0.625rem;
  flex: none;
}
.lc-toggle { display: flex; gap: 0.5rem; align-items: center; flex: none; cursor: pointer; }
.lc-check {
  inline-size: 1.15rem;
  block-size: 1.15rem;
  accent-color: var(--lc-accent);
  flex: none;
  cursor: pointer;
  margin: 0;
}
.lc-services { margin-block-start: 0.75rem; display: grid; gap: 0.5rem; }
.lc-service { border-block-start: 1px solid var(--lc-border); padding-block-start: 0.5rem; }
.lc-service-head { display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; }
.lc-disclose {
  cursor: pointer;
  color: var(--lc-fg);
  font-size: 0.8125rem;
  text-decoration: underline;
  padding: 0.25rem 0;
}
.lc-cookies { margin-block-start: 0.5rem; overflow-x: auto; }
.lc-table { inline-size: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.lc-table th, .lc-table td {
  border: 1px solid var(--lc-border);
  padding: 0.375rem 0.5rem;
  vertical-align: top;
}
.lc-table th { background: var(--lc-surface); font-weight: 600; }
.lc-fab {
  position: fixed;
  z-index: var(--lc-z);
  /* Declared twice on purpose: an engine without env() drops the whole max()
     declaration, and inset-block-end would fall back to auto — which un-pins
     a fixed element and would cost the zero-CLS guarantee (NFR-2). */
  inset-block-end: var(--lc-fab-inset);
  inset-block-end: max(var(--lc-fab-inset), env(safe-area-inset-bottom, 0px));
  inset-inline-start: var(--lc-fab-inset);
  display: grid;
  place-items: center;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  cursor: pointer;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 600;
  opacity: 0.72;
  background: var(--lc-bg);
  color: var(--lc-fg);
  border: 1px solid var(--lc-border);
  box-shadow: var(--libreconsent-shadow, 0 6px 28px rgba(0, 0, 0, 0.18));
}
.lc-fab[data-lc-position="bottom-end"] {
  inset-inline-start: auto;
  inset-inline-end: var(--lc-fab-inset);
}
/* Out of flow, and never a pointer target: revealing the label cannot resize
   the disc, so nothing moves however the button is anchored or the document is
   directed (NFR-2), and the disc's own :hover cannot flicker as the pointer
   crosses the label. */
.lc-fab-label {
  position: absolute;
  inset-block: 0;
  inset-inline-start: calc(100% + 0.375rem);
  display: grid;
  align-items: center;
  padding-inline: 0.875rem;
  white-space: nowrap;
  border-radius: 999px;
  background: var(--lc-bg);
  border: 1px solid var(--lc-border);
  box-shadow: var(--libreconsent-shadow, 0 6px 28px rgba(0, 0, 0, 0.18));
  opacity: 0;
  pointer-events: none;
}
.lc-fab[data-lc-position="bottom-end"] .lc-fab-label {
  inset-inline-start: auto;
  inset-inline-end: calc(100% + 0.375rem);
}
.lc-fab-icon {
  position: relative;
  inline-size: 1.125rem;
  block-size: 1.125rem;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}
.lc-fab-icon::before, .lc-fab-icon::after { content: ""; position: absolute; border-radius: 50%; }
.lc-fab-icon::before {
  inset-block-start: 0.1875rem;
  inset-inline-start: 0.1875rem;
  inline-size: 0.1875rem;
  block-size: 0.1875rem;
  background: currentColor;
  box-shadow: 0.4375rem 0.125rem 0 currentColor, 0.0625rem 0.4375rem 0 currentColor;
}
/* Neither state may read as good or bad, so what separates them is a shape —
   filled disc against hollow ring — and neither colour is green or red (UI-7). */
.lc-fab-icon::after {
  inset-block-end: -0.25rem;
  inset-inline-end: -0.3125rem;
  inline-size: 0.5rem;
  block-size: 0.5rem;
  border: 1.5px solid var(--lc-muted);
  background: var(--lc-bg);
}
.lc-fab[data-lc-consent="extended"] .lc-fab-icon::after {
  border-color: var(--lc-accent);
  background: var(--lc-accent);
}
.lc-fab:hover, .lc-fab:focus-visible { opacity: 1; }
.lc-fab:focus-visible .lc-fab-label { opacity: 1; }
/* Only :hover is gated, so a coarse-pointer device with a keyboard attached
   still reveals the label on focus. */
@media (hover: hover) {
  .lc-fab:hover .lc-fab-label { opacity: 1; }
}
[hidden] { display: none !important; }
@media (prefers-reduced-motion: no-preference) {
  .lc-btn, .lc-close, .lc-disclose { transition: opacity 120ms ease, background-color 120ms ease; }
  .lc-fab, .lc-fab-label { transition: opacity 120ms ease; }
}
@media (max-width: 30rem) {
  .lc-btn { flex: 1 1 100%; }
  .lc-actions { inline-size: 100%; }
}
`;
