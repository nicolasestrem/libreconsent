import { translate } from "./i18n";
import type { ConsentApi, ConsentState, NormalizedCmpConfig } from "./types";

type GatedKind = "script" | "iframe" | "placeholder";

/** A gated script, declared in markup or produced by the BLK-4 net. */
const SCRIPT_GATE = 'script[type="text/plain"][data-cmp-category]';

/**
 * Matches the three declarative gates in document order. One combined query
 * keeps script execution order aligned with markup order (BLK-1).
 */
const SELECTOR = [
  SCRIPT_GATE,
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

  // A gate produced by the BLK-4 net holds its URL here rather than in `src`,
  // so that nothing can make the original fetch it. Restore it now.
  const diverted = original.getAttribute("data-cmp-src");
  if (diverted !== null) {
    script.setAttribute("src", diverted);
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

    // Started before the DOM-readiness branch below returns: the whole point of
    // the net is to be watching for the earliest possible injection (BLK-4).
    this.observe();

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

  /**
   * Installs the best-effort dynamic-injection net (BLK-4).
   *
   * Two halves. The prototype patch is what actually stops the tag: a matching
   * URL is diverted into `data-cmp-src` and never assigned, so the element has
   * no source to fetch. The observer then registers those elements as ordinary
   * gates so a later grant runs them through the same chain as markup.
   *
   * Interception has to happen before insertion. Once a script with a real `src`
   * is inserted it has already been prepared and its fetch started, and neither
   * detaching it nor changing its `type` cancels the execution that follows —
   * measured in Chromium, and the reason BLK-4 cannot be more than best-effort.
   * Anything that does not pass through these two entry points still runs: a
   * parser-inserted tag, `document.write`, a captured native setter, another
   * realm. The guaranteed path remains BLK-1 markup.
   *
   * Nothing is installed unless the host configured a pattern, so a page that
   * does not use the net pays nothing for it.
   */
  private observe(): void {
    const blocklist = this.config.blocking.blocklist;
    if (
      blocklist.length === 0 ||
      typeof MutationObserver === "undefined" ||
      typeof HTMLScriptElement === "undefined"
    ) {
      return;
    }

    const prototype = HTMLScriptElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "src");
    const nativeSet = descriptor?.set;
    const nativeSetAttribute = prototype.setAttribute;

    /**
     * Diverts a blocklisted URL into `data-cmp-src`, returning whether it did.
     *
     * The URL is never assigned to the real `src`, so the element has nothing
     * to fetch no matter what happens to it afterwards — resetting `type` to a
     * JavaScript MIME type cannot resurrect a script that has no source. Only
     * `recreate()` reassembles it, and only on a grant. This mirrors how an
     * iframe gate holds its URL (BLK-3).
     */
    const gate = (script: HTMLScriptElement, url: unknown): boolean => {
      // Coerced rather than type-checked: under `require-trusted-types-for`
      // conforming code assigns a TrustedScriptURL, and `new URL(...)` is
      // common. Rejecting non-strings here would fail open on exactly the
      // most hardened pages.
      const href = String(url);
      if (script.hasAttribute("data-cmp-category")) {
        return false;
      }
      const match = blocklist.find((candidate) =>
        href.includes(candidate.pattern),
      );
      if (match === undefined) {
        return false;
      }
      const service = match.service ?? null;
      if (this.granted(match.category, service)) {
        return false;
      }

      // The element must end up looking exactly like a declarative gate so
      // `recreate()` can restore it. The attribute writes deliberately use the
      // captured native method rather than re-entering the patch below.
      const type = script.getAttribute("type");
      if (type !== null && type.trim() !== "") {
        // Preserved so a gated module is not replayed as a classic script.
        nativeSetAttribute.call(script, "data-cmp-type", type);
      }
      script.type = "text/plain";
      nativeSetAttribute.call(script, "data-cmp-src", href);
      nativeSetAttribute.call(script, "data-cmp-category", match.category);
      if (service !== null) {
        nativeSetAttribute.call(script, "data-cmp-service", service);
      }
      return true;
    };

    const patchedSet =
      nativeSet === undefined
        ? undefined
        : function (this: HTMLScriptElement, value: string): void {
            if (!gate(this, value)) {
              nativeSet.call(this, value);
            }
          };
    if (descriptor !== undefined && patchedSet !== undefined) {
      Object.defineProperty(prototype, "src", {
        ...descriptor,
        set: patchedSet,
      });
    }
    // Own property on the script prototype, so no other element is affected.
    const patchedSetAttribute = function (
      this: Element,
      name: string,
      value: string,
    ): void {
      if (
        name.toLowerCase() === "src" &&
        gate(this as HTMLScriptElement, value)
      ) {
        return;
      }
      nativeSetAttribute.call(this, name, value);
    };
    prototype.setAttribute = patchedSetAttribute;

    const observer = new MutationObserver((mutations) => {
      // Before the first scan the observer stays out of the way: `scan()` finds
      // every gate then present in one document-order query, and registering
      // here first would put a gate parsed after init() ahead of one parsed
      // before it — silently inverting BLK-1's execution order. Nothing is
      // lost, because `apply()` does not run until the scan has happened.
      if (!this.scanned) {
        return;
      }
      let added = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) {
            continue;
          }
          const element = node as Element;
          // Descendants of an inserted node are not reported separately, and a
          // gate appended to a detached container is only registrable once
          // that container enters the document.
          const gates = element.matches(SCRIPT_GATE)
            ? [element]
            : element.querySelectorAll(SCRIPT_GATE);
          for (const found of gates) {
            added = this.track(found as HTMLElement) !== null || added;
          }
        }
      }
      if (added) {
        // A gate inserted under an already-granted category must still run.
        this.apply();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    this.cleanup.push(() => {
      observer.disconnect();
      // Restored only if still ours: another library may have patched the same
      // prototype afterwards, and uninstalling its patch would be worse than
      // leaving ours in place. The prototype had no own `setAttribute` before.
      if (prototype.setAttribute === patchedSetAttribute) {
        delete (prototype as Partial<Element>).setAttribute;
      }
      if (
        descriptor !== undefined &&
        Object.getOwnPropertyDescriptor(prototype, "src")?.set === patchedSet
      ) {
        Object.defineProperty(prototype, "src", descriptor);
      }
    });
  }

  private scan(): void {
    if (this.scanned) {
      return;
    }
    this.scanned = true;
    for (const element of document.querySelectorAll<HTMLElement>(SELECTOR)) {
      this.track(element);
    }
  }

  /**
   * Registers one gated element, or returns null when it names no category or
   * is already tracked. Shared by the initial scan and the BLK-4 observer.
   *
   * Blocking a non-script gate happens here rather than in the caller, so that
   * no registration path can ever leave an embed tracked but still visible and
   * still able to reach the network.
   */
  private track(element: HTMLElement): GatedEntry | null {
    const category = element.getAttribute("data-cmp-category");
    if (category === null || category.trim() === "") {
      return null;
    }
    if (this.entries.some((existing) => existing.element === element)) {
      return null;
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
    return entry;
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
      const granted = this.open(entry);
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
  private granted(category: string, service: string | null): boolean {
    if (this.state === null) {
      return false;
    }
    return service === null
      ? this.state.categories[category] === true
      : this.state.services[service] === true;
  }

  private open(entry: GatedEntry): boolean {
    return this.granted(entry.category, entry.service);
  }

  private revoked(): boolean {
    return this.entries.some(
      (entry) => entry.kind === "script" && entry.executed && !this.open(entry),
    );
  }

  private async run(pending: GatedEntry[]): Promise<void> {
    for (const entry of pending) {
      // Consent can be withdrawn while an earlier gate in this round is still
      // loading, so the grant is re-read immediately before each execution
      // rather than trusted from when the round was queued. Clearing the flag
      // keeps a skipped gate eligible if consent is granted again later.
      if (!this.open(entry)) {
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
    // A net-produced gate keeps its URL in `data-cmp-src`, so both are external.
    const source =
      original.getAttribute("src") ?? original.getAttribute("data-cmp-src");
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
