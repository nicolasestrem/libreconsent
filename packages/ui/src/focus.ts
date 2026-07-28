// SPDX-License-Identifier: MIT
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Resolves the deepest focused element, descending through shadow roots.
 *
 * `document.activeElement` reports the shadow host rather than the control the
 * user is actually on, so focus restore needs the inner element.
 */
export function activeElement(): Element | null {
  let current: Element | null = document.activeElement;
  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }
  return current;
}

/** Tabbable elements inside `container`, skipping hidden subtrees. */
export function focusable(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.closest("[hidden]") === null,
  );
}

/**
 * Traps Tab within `container` and reports Escape.
 *
 * The listener is bound to the container rather than the document so a second
 * trap (preferences opened over a modal-layout banner) cannot fight the first.
 * Returns a release function that also restores focus to `restoreTo`.
 */
export function trapFocus(
  container: HTMLElement,
  onEscape: () => void,
  restoreTo: Element | null,
): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const targets = focusable(container);
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const current = activeElement();
    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener("keydown", onKeyDown);
  return () => {
    container.removeEventListener("keydown", onKeyDown);
    if (restoreTo instanceof HTMLElement && restoreTo.isConnected) {
      restoreTo.focus();
    }
  };
}

/** Moves focus to the first control inside `container`, else to `container`. */
export function focusFirst(container: HTMLElement): void {
  (focusable(container)[0] ?? container).focus();
}
