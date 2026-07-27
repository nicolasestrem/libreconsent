// SPDX-License-Identifier: MIT
import type { RenderContext } from "./context";
import { el } from "./dom";

/** Handlers wired to the opt-out dialog's controls. */
export interface OptOutActions {
  /** Records the sale/share opt-out. */
  confirm(): void;
  /** Dismisses the dialog without changing consent. */
  close(): void;
}

/** A rendered "Do Not Sell or Share" dialog. */
export interface OptOut {
  /** Overlay element to insert. */
  root: HTMLElement;
  /** The dialog itself, used for focus management. */
  dialog: HTMLElement;
}

/**
 * Builds the minimal US opt-out dialog (US-2).
 *
 * Deliberately not the consent banner: US state privacy is an opt-out regime,
 * so this surface states one thing and offers one action instead of asking for
 * a decision. When the opt-out is already in force it says so rather than
 * offering an action that would change nothing.
 */
export function createOptOut(
  context: RenderContext,
  alreadyOptedOut: boolean,
  actions: OptOutActions,
): OptOut {
  const titleId = context.id("optout-title");
  const descriptionId = context.id("optout-description");

  const close = el(
    "button",
    {
      type: "button",
      class: "lc-close",
      "data-lc-action": "close",
      "aria-label": context.t("ui.close"),
    },
    ["×"],
  );
  close.addEventListener("click", actions.close);

  const dismiss = el(
    "button",
    {
      type: "button",
      class: alreadyOptedOut ? "lc-btn lc-btn--ghost" : "lc-btn lc-btn--link",
      "data-lc-action": "dismiss",
    },
    [context.t("ui.close")],
  );
  dismiss.addEventListener("click", actions.close);

  const actionRow: HTMLElement[] = [];
  if (alreadyOptedOut) {
    actionRow.push(dismiss);
  } else {
    const confirm = el(
      "button",
      {
        type: "button",
        class: "lc-btn lc-btn--primary",
        "data-lc-action": "opt-out",
      },
      [context.t("ui.optOut.confirm")],
    );
    confirm.addEventListener("click", actions.confirm);
    actionRow.push(confirm, dismiss);
  }

  const dialog = el(
    "div",
    {
      class: "lc-modal lc-modal--narrow lc-surface",
      "data-lc-optout": "",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      "aria-describedby": descriptionId,
      tabindex: "-1",
    },
    [
      el("div", { class: "lc-modal-head" }, [
        el("h2", { class: "lc-title", id: titleId }, [
          context.t("ui.optOut.title"),
        ]),
        close,
      ]),
      el("div", { class: "lc-modal-body" }, [
        el("p", { class: "lc-text", id: descriptionId }, [
          context.t(
            alreadyOptedOut ? "ui.optOut.done" : "ui.optOut.description",
          ),
        ]),
      ]),
      el("div", { class: "lc-modal-foot" }, [
        el("div", { class: "lc-actions" }, actionRow),
      ]),
    ],
  );

  return {
    root: el("div", { class: "lc-overlay", "data-lc-overlay": "" }, [dialog]),
    dialog,
  };
}
