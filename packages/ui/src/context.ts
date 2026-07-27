// SPDX-License-Identifier: MIT
import type {
  NormalizedCategoryConfig,
  NormalizedServiceConfig,
} from "@libreconsent/core";
import type { BannerLayout } from "./options";

/** Shared rendering helpers handed to the banner and preferences layers. */
export interface RenderContext {
  /** Resolves a translation key in the mounted locale. */
  t(key: string): string;
  /** Namespaces an element id so light-DOM mounts cannot collide. */
  id(suffix: string): string;
  /** First-layer presentation. */
  layout: BannerLayout;
}

/**
 * Services of `category` that can actually be granted in `region`.
 *
 * The core forces region-inapplicable services to denied, so rendering a
 * toggle for one would promise a choice that cannot be honored.
 */
export function applicableServices(
  category: NormalizedCategoryConfig,
  region: string | null,
): NormalizedServiceConfig[] {
  return category.services.filter(
    (service) =>
      service.onlyRegions.length === 0 ||
      (region !== null && service.onlyRegions.includes(region)),
  );
}
