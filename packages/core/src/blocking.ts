import { translate } from "./i18n";
import type { ConsentApi, ConsentState, NormalizedCmpConfig } from "./types";

type GatedKind = "script" | "iframe" | "placeholder";

/**
 * Matches the three declarative gates in document order. One combined query
 * keeps script execution order aligned with markup order (BLK-1).
 */
const SELECTOR = [
  'script[type="text/plain"][data-cmp-category]',
  "iframe[data-cmp-src][data-cmp-category]",
  "[data-cmp-placeholder][data-cmp-category]",
].join(",");

/**
 * Minimal self-contained placeholder styling. Themed presentation belongs to
 * the UI package; this only has to be legible without any external asset.
 */
const PLACEHOLDER_STYLE =
  "border:1px solid currentColor;padding:1rem;text-align:center";

interface GatedEntry {
  kind: GatedKind;
  element: HTMLElement;
  category: string;
  service: string | null;
  /**
   * Scripts only. Queued into an unblock round but not yet reached. Cleared if
   * that round skips the gate, so a later grant can queue it again.
   */
  scheduled: boolean;
  /**
   * Scripts only. Set when the replacement actually enters the document, which
   * is the only point after which execution cannot be undone (BLK-5).
   */
  executed: boolean;
  /** Embeds only. Guards repeated grant events from reloading the embed. */
  revealed: boolean;
  placeholder: HTMLElement | null;
  /** Author's inline `display` value, restored when the embed is revealed. */
  previousDisplay: string;
}

function kindOf(element: HTMLElement): GatedKind {
  if (element.tagName === "SCRIPT") {
    return "script";
  }
  return element.tagName === "IFRAME" && element.hasAttribute("data-cmp-src")
    ? "iframe"
    : "placeholder";
}

/**
 * Re-creates one gated script so the browser executes it.
 *
 * `type` and `data-cmp-*` are dropped, every other attribute is carried over,
 * and the replacement takes the original's DOM position so relative order and
 * surrounding markup are preserved.
 */
function recreate(
  original: HTMLScriptElement,
  fallbackNonce: string | undefined,
): HTMLScriptElement {
  const script = document.createElement("script");
  for (const attribute of Array.from(original.attributes)) {
    if (
      attribute.name === "type" ||
      attribute.name === "nonce" ||
      attribute.name.startsWith("data-cmp-")
    ) {
      continue;
    }
    script.setAttribute(attribute.name, attribute.value);
  }

  const type = original.getAttribute("data-cmp-type");
  if (type !== null && type.trim() !== "") {
    script.type = type;
  }

  // The nonce IDL property is read first: CSP nonce hiding blanks the content
  // attribute after parsing, so getAttribute alone would lose it (BLK-2).
  const nonce =
    original.nonce || original.getAttribute("nonce") || fallbackNonce;
  if (nonce) {
    script.nonce = nonce;
  }
  return script;
}

/**
 * Applies consent decisions to declaratively gated scripts and embeds.
 *
 * Subscribes to the same replayable `consent` plus `change` pair as the Consent
 * Mode adapter, so a restored decision needs no separate initialization path.
 */
export class BlockingController {
  private readonly entries: GatedEntry[] = [];

  private readonly cleanup: (() => void)[] = [];

  private state: ConsentState | null = null;

  private scanned = false;

  /** Serializes successive unblock rounds so document order always holds. */
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly api: ConsentApi,
    private readonly config: NormalizedCmpConfig,
    private readonly reloadFn: () => void = () => {
      window.location.reload();
    },
  ) {
    if (typeof document === "undefined") {
      return;
    }

    const update = (state: ConsentState): void => {
      this.state = state;
      this.apply();
    };
    this.cleanup.push(
      this.api.on("consent", update),
      this.api.on("change", update),
    );

    // init() may run from <head> before the body exists, and the core never
    // waits for the DOM elsewhere, so readiness is owned here.
    if (document.readyState === "loading") {
      const onReady = (): void => {
        this.scan();
        this.apply();
      };
      document.addEventListener("DOMContentLoaded", onReady, { once: true });
      this.cleanup.push(() => {
        document.removeEventListener("DOMContentLoaded", onReady);
      });
      return;
    }
    this.scan();
    this.apply();
  }

  dispose(): void {
    for (const cleanup of this.cleanup.splice(0)) {
      cleanup();
    }
  }

  private scan(): void {
    if (this.scanned) {
      return;
    }
    this.scanned = true;
    for (const element of Array.from(
      document.querySelectorAll<HTMLElement>(SELECTOR),
    )) {
      const category = element.getAttribute("data-cmp-category");
      if (category === null || category.trim() === "") {
        continue;
      }
      const service = element.getAttribute("data-cmp-service");
      const entry: GatedEntry = {
        kind: kindOf(element),
        element,
        category: category.trim(),
        service:
          service !== null && service.trim() !== "" ? service.trim() : null,
        scheduled: false,
        executed: false,
        revealed: false,
        placeholder: null,
        previousDisplay: "",
      };
      this.entries.push(entry);
      if (entry.kind !== "script") {
        this.block(entry);
      }
    }
  }

  private apply(): void {
    if (!this.scanned) {
      return;
    }

    // Reload is checked before anything else runs: the document is about to be
    // discarded, and after the reload the denied script simply never executes.
    if (this.config.blocking.reloadOnWithdraw && this.revoked()) {
      this.reloadFn();
      return;
    }

    const pending: GatedEntry[] = [];
    for (const entry of this.entries) {
      const granted = this.granted(entry);
      if (entry.kind === "script") {
        if (granted && !entry.scheduled) {
          // Marked before the asynchronous chain runs so a decision arriving
          // mid-chain cannot schedule the same script twice. This records only
          // the queueing: `executed` is what withdrawal reads, and it is set
          // where the replacement actually enters the document.
          entry.scheduled = true;
          pending.push(entry);
        }
      } else if (granted && !entry.revealed) {
        this.reveal(entry);
      } else if (!granted && entry.revealed) {
        this.block(entry);
      }
    }

    if (pending.length > 0) {
      // A failed round must not leave the chain rejected: that would silently
      // drop every later grant on the page and surface as an unhandled
      // rejection instead of a contained failure.
      this.chain = this.chain.then(() => this.run(pending)).catch(() => {});
    }
  }

  /**
   * A gate opens on its service when one is named, otherwise on its category.
   * Unknown IDs read as `undefined` and therefore stay blocked (fail closed),
   * as do services outside their configured regions.
   */
  private granted(entry: GatedEntry): boolean {
    if (this.state === null) {
      return false;
    }
    return entry.service === null
      ? this.state.categories[entry.category] === true
      : this.state.services[entry.service] === true;
  }

  private revoked(): boolean {
    return this.entries.some(
      (entry) =>
        entry.kind === "script" && entry.executed && !this.granted(entry),
    );
  }

  private async run(pending: GatedEntry[]): Promise<void> {
    for (const entry of pending) {
      // Consent can be withdrawn while an earlier gate in this round is still
      // loading, so the grant is re-read immediately before each execution
      // rather than trusted from when the round was queued. Clearing the flag
      // keeps a skipped gate eligible if consent is granted again later.
      if (!this.granted(entry)) {
        entry.scheduled = false;
        continue;
      }
      await this.execute(entry);
    }
  }

  private execute(entry: GatedEntry): Promise<void> {
    const original = entry.element as HTMLScriptElement;
    if (original.parentNode === null) {
      return Promise.resolve();
    }
    const script = recreate(original, this.config.blocking.nonce);
    const source = original.getAttribute("src");
    const inline = source === null;
    if (inline) {
      script.textContent = original.textContent;
    }

    // Execution is recorded here rather than at queue time, so a gate that was
    // detached, skipped, or failed to be re-created never counts as executed —
    // and therefore never triggers a `reloadOnWithdraw` reload that has nothing
    // to undo.
    const insert = (): void => {
      original.replaceWith(script);
      entry.executed = true;
    };

    // An inline module is the one inline gate that does not run on insertion:
    // evaluation is deferred, and `load` fires once it completes. Treating it
    // as synchronous would let a following classic gate run ahead of it.
    if (inline && script.type !== "module") {
      insert();
      return Promise.resolve();
    }
    if (original.hasAttribute("async")) {
      // Running out of order is exactly what `async` asks for; preserve it.
      insert();
      return Promise.resolve();
    }
    if (!inline) {
      // Script-inserted scripts are async by default. Clearing that and
      // awaiting the fetch is what keeps a src/inline mix in document order.
      script.async = false;
    }

    const settled = new Promise<void>((resolve) => {
      const finish = (): void => {
        resolve();
      };
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", finish, { once: true });
    });
    insert();
    return settled;
  }

  private reveal(entry: GatedEntry): void {
    entry.revealed = true;
    entry.placeholder?.remove();
    entry.placeholder = null;
    entry.element.hidden = false;
    entry.element.style.display = entry.previousDisplay;
    if (entry.kind === "iframe") {
      const source = entry.element.getAttribute("data-cmp-src");
      if (source !== null) {
        entry.element.setAttribute("src", source);
      }
    }
  }

  private block(entry: GatedEntry): void {
    entry.revealed = false;
    if (entry.kind === "iframe") {
      // Only an iframe gate has a `data-cmp-src` to restore from, so only an
      // iframe's `src` may be removed. A generic gate's own `src` is left
      // alone: stripping it could not prevent a fetch that the parser already
      // started, and would permanently break the element on reveal.
      entry.element.removeAttribute("src");
    }
    entry.previousDisplay = entry.element.style.display;
    entry.element.hidden = true;
    // `hidden` alone loses to a site stylesheet; inline display cannot.
    entry.element.style.display = "none";
    if (entry.placeholder === null) {
      entry.placeholder = this.placeholderFor(entry);
      entry.element.before(entry.placeholder);
    }
  }

  private placeholderFor(entry: GatedEntry): HTMLElement {
    const container = document.createElement("div");
    container.setAttribute("data-libreconsent-placeholder", "");
    container.style.cssText = PLACEHOLDER_STYLE;

    const notice = document.createElement("p");
    notice.textContent = translate(this.config.i18n, "blocked.notice");

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = translate(this.config.i18n, "blocked.accept");
    button.addEventListener("click", () => {
      try {
        this.api.setConsent(
          entry.service === null
            ? { categories: { [entry.category]: true } }
            : { services: { [entry.service]: true } },
        );
      } catch {
        // A gate naming a readonly or unknown ID must not break the page.
      }
    });

    container.append(notice, button);
    return container;
  }
}
