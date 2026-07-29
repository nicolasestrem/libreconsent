// SPDX-License-Identifier: MIT
import { describe, expect, test } from "vitest";
import { normalizeOptions, type UiOptions } from "./options";

function expectOptionsError(options: unknown, path: string): void {
  try {
    normalizeOptions(options as UiOptions);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message.startsWith(`${path}: `)).toBe(true);
    return;
  }
  throw new Error(`Expected normalizeOptions to fail at ${path}`);
}

describe("renderer option normalization (UI-1, UI-4, UI-5, UI-6, UI-8)", () => {
  test("defaults every option when none are supplied", () => {
    expect(normalizeOptions()).toEqual({
      layout: "bar-bottom",
      theme: "auto",
      shadow: true,
      container: null,
      floatingButton: true,
      floatingButtonPosition: "bottom-start",
      locale: null,
    });
    expect(normalizeOptions({})).toEqual(normalizeOptions());
  });

  test("keeps every supplied option", () => {
    const container = document.createElement("div");

    expect(
      normalizeOptions({
        layout: "modal",
        theme: "dark",
        shadow: false,
        container,
        floatingButton: false,
        floatingButtonPosition: "bottom-end",
        locale: "fr",
      }),
    ).toEqual({
      layout: "modal",
      theme: "dark",
      shadow: false,
      container,
      floatingButton: false,
      floatingButtonPosition: "bottom-end",
      locale: "fr",
    });
  });

  test.each(["bar-bottom", "box", "modal"] as const)(
    "accepts the %s layout",
    (layout) => {
      expect(normalizeOptions({ layout }).layout).toBe(layout);
    },
  );

  test.each(["auto", "light", "dark"] as const)(
    "accepts the %s theme",
    (theme) => {
      expect(normalizeOptions({ theme }).theme).toBe(theme);
    },
  );

  test.each(["bottom-start", "bottom-end"] as const)(
    "accepts the %s floating button position",
    (floatingButtonPosition) => {
      expect(
        normalizeOptions({ floatingButtonPosition }).floatingButtonPosition,
      ).toBe(floatingButtonPosition);
    },
  );

  test.each([
    {
      name: "an unknown layout",
      options: { layout: "top-bar" },
      path: "options.layout",
    },
    {
      name: "an unknown theme",
      options: { theme: "midnight" },
      path: "options.theme",
    },
    {
      name: "a non-boolean shadow",
      options: { shadow: "yes" },
      path: "options.shadow",
    },
    {
      name: "a non-boolean floatingButton",
      options: { floatingButton: 1 },
      path: "options.floatingButton",
    },
    {
      name: "an unknown floatingButtonPosition",
      options: { floatingButtonPosition: "top-start" },
      path: "options.floatingButtonPosition",
    },
    {
      name: "a non-Element container",
      options: { container: { nodeType: 1 } },
      path: "options.container",
    },
    {
      name: "a non-string locale",
      options: { locale: 42 },
      path: "options.locale",
    },
    {
      name: "a null options argument",
      options: null,
      path: "options",
    },
  ])("throws at $path for $name", ({ options, path }) => {
    expectOptionsError(options, path);
  });
});
