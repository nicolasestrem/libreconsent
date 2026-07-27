import type {
  ConsentSelection,
  CookieTableRow,
  NormalizedCategoryConfig,
  NormalizedCmpConfig,
  NormalizedServiceConfig,
} from "@libreconsent/core";
import { applicableServices, type RenderContext } from "./context";
import { el } from "./dom";

/** Handlers wired to the second-layer buttons. */
export interface PreferencesActions {
  save(selection: ConsentSelection): void;
  accept(): void;
  reject(): void;
  close(): void;
}

/** Category and service choices used to fill the controls. */
export interface Choices {
  categories: Record<string, boolean>;
  services: Record<string, boolean>;
}

/** A rendered second layer. */
export interface Preferences {
  /** Overlay element to insert. */
  root: HTMLElement;
  /** The dialog itself, used for focus management. */
  dialog: HTMLElement;
  /** Fills every control from `choices`. */
  sync(choices: Choices): void;
}

const COOKIE_COLUMNS = ["provider", "duration", "type"] as const;

type OptionalColumn = (typeof COOKIE_COLUMNS)[number];

/**
 * True when a category can be rendered as an actionable section.
 *
 * A category whose services are all region-excluded is omitted: nothing in it
 * can be granted here, so a toggle would be inert.
 */
function isRenderable(
  category: NormalizedCategoryConfig,
  region: string | null,
): boolean {
  return (
    category.readonly ||
    category.services.length === 0 ||
    applicableServices(category, region).length > 0
  );
}

function cookieTable(
  context: RenderContext,
  rows: CookieTableRow[],
): HTMLElement {
  const columns = COOKIE_COLUMNS.filter((column) =>
    rows.some((row) => row[column] !== undefined),
  );
  const head = el("tr", {}, [
    el("th", { scope: "col" }, [context.t("ui.cookies.name")]),
    el("th", { scope: "col" }, [context.t("ui.cookies.purpose")]),
    ...columns.map((column) =>
      el("th", { scope: "col" }, [context.t(`ui.cookies.${column}`)]),
    ),
  ]);
  const body = rows.map((row) =>
    el("tr", {}, [
      el("td", {}, [row.name]),
      el("td", {}, [context.t(row.purpose)]),
      ...columns.map((column: OptionalColumn) => {
        const value = row[column];
        return el("td", {}, [value === undefined ? "—" : context.t(value)]);
      }),
    ]),
  );
  return el("table", { class: "lc-table" }, [
    el("thead", {}, [head]),
    el("tbody", {}, body),
  ]);
}

function cookieDisclosure(
  context: RenderContext,
  service: NormalizedServiceConfig,
): HTMLElement[] {
  if (service.cookies.length === 0) {
    return [];
  }
  const panelId = context.id(`cookies-${service.id}`);
  const panel = el("div", { class: "lc-cookies", id: panelId, hidden: true }, [
    cookieTable(context, service.cookies),
  ]);
  const toggle = el(
    "button",
    {
      type: "button",
      class: "lc-disclose",
      "aria-expanded": "false",
      "aria-controls": panelId,
    },
    [context.t("ui.cookies.show")],
  );
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    panel.hidden = expanded;
    toggle.textContent = context.t(
      expanded ? "ui.cookies.show" : "ui.cookies.hide",
    );
  });
  return [toggle, panel];
}

function checkbox(labelledBy: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "lc-check";
  input.setAttribute("aria-labelledby", labelledBy);
  return input;
}

/**
 * Renders the second layer (UI-2).
 *
 * Readonly categories are shown with an "always on" badge and no control at
 * all: the core rejects any attempt to change them, so offering a disabled
 * toggle would only suggest the choice exists (UI-7, CORE-6).
 */
export function createPreferences(
  context: RenderContext,
  config: NormalizedCmpConfig,
  region: string | null,
  actions: PreferencesActions,
): Preferences {
  const titleId = context.id("prefs-title");
  const descriptionId = context.id("prefs-description");
  const categoryInputs = new Map<string, HTMLInputElement>();
  const serviceInputs = new Map<string, HTMLInputElement>();
  /** Optional categories rendered as a single toggle (no services). */
  const standaloneCategories: string[] = [];

  const sections = config.categories
    .filter((category) => isRenderable(category, region))
    .map((category) => {
      const categoryTitleId = context.id(`cat-${category.id}`);
      const services = applicableServices(category, region);
      const control: HTMLElement[] = [];

      if (category.readonly) {
        control.push(
          el("span", { class: "lc-badge" }, [context.t("ui.alwaysOn")]),
        );
      } else {
        const input = checkbox(categoryTitleId);
        categoryInputs.set(category.id, input);
        if (services.length === 0) {
          standaloneCategories.push(category.id);
        }
        control.push(input);
      }

      const serviceItems = services.map((service) => {
        const serviceTitleId = context.id(`svc-${service.id}`);
        const label = el("span", { id: serviceTitleId }, [
          context.t(service.label),
        ]);
        const head: (Node | string)[] = [label];
        if (!category.readonly) {
          const input = checkbox(serviceTitleId);
          serviceInputs.set(service.id, input);
          input.addEventListener("change", () => {
            syncCategoryFromServices(category);
          });
          head.push(input);
        }
        return el("li", { class: "lc-service" }, [
          el("div", { class: "lc-service-head" }, head),
          ...cookieDisclosure(context, service),
        ]);
      });

      return el(
        "section",
        { class: "lc-group", "data-lc-category": category.id },
        [
          el("div", { class: "lc-group-head" }, [
            el("h3", { class: "lc-group-title", id: categoryTitleId }, [
              context.t(category.label),
            ]),
            ...control,
          ]),
          el("p", { class: "lc-group-desc" }, [
            context.t(category.description),
          ]),
          ...(serviceItems.length > 0
            ? [el("ul", { class: "lc-services" }, serviceItems)]
            : []),
        ],
      );
    });

  function syncCategoryFromServices(category: NormalizedCategoryConfig): void {
    const input = categoryInputs.get(category.id);
    const services = applicableServices(category, region);
    if (!input || services.length === 0) {
      return;
    }
    const checked = services.filter(
      (service) => serviceInputs.get(service.id)?.checked === true,
    ).length;
    input.checked = checked > 0;
    input.indeterminate = checked > 0 && checked < services.length;
  }

  for (const category of config.categories) {
    const input = categoryInputs.get(category.id);
    const services = applicableServices(category, region);
    if (!input || services.length === 0) {
      continue;
    }
    input.addEventListener("change", () => {
      for (const service of services) {
        const serviceInput = serviceInputs.get(service.id);
        if (serviceInput) {
          serviceInput.checked = input.checked;
        }
      }
      input.indeterminate = false;
    });
  }

  const save = el(
    "button",
    {
      type: "button",
      class: "lc-btn lc-btn--primary",
      "data-lc-action": "save",
    },
    [context.t("ui.save")],
  );
  const accept = el(
    "button",
    {
      type: "button",
      class: "lc-btn lc-btn--ghost",
      "data-lc-action": "accept",
    },
    [context.t("ui.acceptAll")],
  );
  const reject = el(
    "button",
    {
      type: "button",
      class: "lc-btn lc-btn--ghost",
      "data-lc-action": "reject",
    },
    [context.t("ui.rejectAll")],
  );
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

  save.addEventListener("click", () => {
    const categories: Record<string, boolean> = {};
    for (const id of standaloneCategories) {
      categories[id] = categoryInputs.get(id)?.checked === true;
    }
    const services: Record<string, boolean> = {};
    for (const [id, input] of serviceInputs) {
      services[id] = input.checked;
    }
    actions.save({ categories, services });
  });
  accept.addEventListener("click", actions.accept);
  reject.addEventListener("click", actions.reject);
  close.addEventListener("click", actions.close);

  const dialog = el(
    "div",
    {
      class: "lc-modal lc-surface",
      "data-lc-preferences": "",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      "aria-describedby": descriptionId,
      tabindex: "-1",
    },
    [
      el("div", { class: "lc-modal-head" }, [
        el("h2", { class: "lc-title", id: titleId }, [
          context.t("ui.preferences.title"),
        ]),
        close,
      ]),
      el("div", { class: "lc-modal-body" }, [
        el("p", { class: "lc-text", id: descriptionId }, [
          context.t("ui.preferences.description"),
        ]),
        ...sections,
      ]),
      el("div", { class: "lc-modal-foot" }, [
        el("div", { class: "lc-actions" }, [save, accept, reject]),
      ]),
    ],
  );

  return {
    root: el("div", { class: "lc-overlay", "data-lc-overlay": "" }, [dialog]),
    dialog,
    sync(choices: Choices): void {
      for (const [id, input] of serviceInputs) {
        input.checked = choices.services[id] === true;
      }
      for (const [id, input] of categoryInputs) {
        const category = config.categories.find((entry) => entry.id === id);
        if (!category) {
          continue;
        }
        if (applicableServices(category, region).length === 0) {
          input.checked = choices.categories[id] === true;
          input.indeterminate = false;
        } else {
          syncCategoryFromServices(category);
        }
      }
    },
  };
}
