/**
 * Attribute values accepted by {@link el}. `false` and `undefined` omit the
 * attribute entirely; `true` writes an empty value.
 */
export type Attributes = Record<string, string | boolean | undefined>;

/**
 * Creates an element from attributes and text/node children.
 *
 * Every string child becomes a text node, so translated and configured prose
 * can never be parsed as markup (G-6).
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes?: Attributes,
  children?: (Node | string)[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes ?? {})) {
    if (value === undefined || value === false) {
      continue;
    }
    node.setAttribute(name, value === true ? "" : value);
  }
  for (const child of children ?? []) {
    node.append(
      typeof child === "string" ? document.createTextNode(child) : child,
    );
  }
  return node;
}

/**
 * Runs `callback` once `document.body` exists.
 *
 * `init()` and `mount()` may both run from `<head>`, so the renderer cannot
 * assume a body is available yet. Returns a cancel function.
 */
export function whenBodyReady(callback: () => void): () => void {
  if (document.body) {
    callback();
    return () => {};
  }
  const listener = (): void => {
    document.removeEventListener("DOMContentLoaded", listener);
    callback();
  };
  document.addEventListener("DOMContentLoaded", listener);
  return () => document.removeEventListener("DOMContentLoaded", listener);
}
