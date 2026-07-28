// SPDX-License-Identifier: MIT
import type { RenderContext } from "./context";
import { el } from "./dom";

/** Decision handlers wired to the first-layer buttons. */
export interface BannerActions {
  accept(): void;
  reject(): void;
  customize(): void;
}

/** A rendered first layer. */
export interface Banner {
  /** Element to insert: the overlay for `modal`, the bar/box otherwise. */
  root: HTMLElement;
  /** The dialog itself, used for focus management. */
  dialog: HTMLElement;
}

/**
 * Renders the first layer (UI-1).
 *
 * Accept and reject are emitted as the same kind of button in the same group,
 * so no theme or layout can give one of them more weight than the other
 * (UI-1 equal prominence, UI-7 no dark patterns).
 */
export function createBanner(
  context: RenderContext,
  actions: BannerActions,
): Banner {
  const titleId = context.id("banner-title");
  const textId = context.id("banner-text");
  const isModal = context.layout === "modal";

  const accept = el(
    "button",
    {
      type: "button",
      class: "lc-btn lc-btn--primary",
      "data-lc-action": "accept",
    },
    [context.t("ui.acceptAll")],
  );
  const reject = el(
    "button",
    {
      type: "button",
      class: "lc-btn lc-btn--primary",
      "data-lc-action": "reject",
    },
    [context.t("ui.rejectAll")],
  );
  const customize = el(
    "button",
    {
      type: "button",
      class: "lc-btn lc-btn--ghost",
      "data-lc-action": "customize",
    },
    [context.t("ui.customize")],
  );

  accept.addEventListener("click", actions.accept);
  reject.addEventListener("click", actions.reject);
  customize.addEventListener("click", actions.customize);

  const dialog = el(
    "div",
    {
      class: "lc-banner lc-surface",
      "data-layout": context.layout,
      "data-lc-banner": "",
      role: "dialog",
      "aria-modal": isModal ? "true" : "false",
      "aria-labelledby": titleId,
      "aria-describedby": textId,
      tabindex: "-1",
    },
    [
      el("div", { class: "lc-inner" }, [
        el("div", { class: "lc-copy" }, [
          el("h2", { class: "lc-title", id: titleId }, [context.t("ui.title")]),
          el("p", { class: "lc-text", id: textId }, [
            context.t("ui.description"),
          ]),
        ]),
        el("div", { class: "lc-actions" }, [accept, reject, customize]),
      ]),
    ],
  );

  if (!isModal) {
    return { root: dialog, dialog };
  }
  return {
    root: el("div", { class: "lc-overlay", "data-lc-overlay": "" }, [dialog]),
    dialog,
  };
}
