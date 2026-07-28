// SPDX-License-Identifier: MIT
import type { ConsentState, NormalizedStorageConfig } from "./types";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StoredDecision {
  state: ConsentState;
  encoded: string;
}

function hasBooleanRecord(value: unknown): value is Record<string, boolean> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "boolean")
  );
}

function isUtcIso(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const timestamp = Date.parse(value);
  return (
    !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function parseState(encoded: string | null): StoredDecision | null {
  if (!encoded) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(encoded));
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const state = parsed as Partial<ConsentState>;
    if (
      typeof state.consentId !== "string" ||
      !UUID_V4.test(state.consentId) ||
      typeof state.revision !== "number" ||
      !Number.isInteger(state.revision) ||
      state.revision < 1 ||
      !hasBooleanRecord(state.categories) ||
      !hasBooleanRecord(state.services) ||
      !isUtcIso(state.createdAt) ||
      !isUtcIso(state.updatedAt) ||
      Date.parse(state.createdAt) > Date.parse(state.updatedAt) ||
      (state.region !== undefined && typeof state.region !== "string") ||
      (state.gpcApplied !== undefined && typeof state.gpcApplied !== "boolean")
    ) {
      return null;
    }
    return { state: state as ConsentState, encoded };
  } catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  try {
    const prefix = `${encodeURIComponent(name)}=`;
    for (const part of document.cookie.split(";")) {
      const trimmed = part.trim();
      if (trimmed.startsWith(prefix)) {
        return trimmed.slice(prefix.length);
      }
    }
  } catch {
    return null;
  }
  return null;
}

function readMirror(name: string): string | null {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

function cookieAttributes(
  config: NormalizedStorageConfig,
  expires: Date,
): string {
  const attributes = [
    "Path=/",
    `Expires=${expires.toUTCString()}`,
    `SameSite=${config.sameSite}`,
  ];
  if (config.domain) {
    attributes.push(`Domain=${config.domain}`);
  }
  try {
    if (location.protocol === "https:") {
      attributes.push("Secure");
    }
  } catch {
    // Non-browser environments simply omit Secure.
  }
  return attributes.join("; ");
}

function writeCookie(
  config: NormalizedStorageConfig,
  encoded: string,
  expires: Date,
): void {
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: synchronous cookie support is required for Safari 15.4.
    document.cookie = `${encodeURIComponent(config.cookieName)}=${encoded}; ${cookieAttributes(config, expires)}`;
  } catch {
    // Storage failures must never affect consent behavior.
  }
}

function writeMirror(name: string, encoded: string): void {
  try {
    window.localStorage.setItem(name, encoded);
  } catch {
    // Storage failures must never affect consent behavior.
  }
}

export function readStored(config: NormalizedStorageConfig): {
  decision: StoredDecision | null;
  source: "cookie" | "mirror" | null;
  cookie: StoredDecision | null;
  mirror: StoredDecision | null;
} {
  const cookie = parseState(readCookie(config.cookieName));
  const mirror = parseState(readMirror(config.cookieName));
  if (cookie) {
    return { decision: cookie, source: "cookie", cookie, mirror };
  }
  if (mirror) {
    return { decision: mirror, source: "mirror", cookie, mirror };
  }
  return { decision: null, source: null, cookie, mirror };
}

export function persistState(
  config: NormalizedStorageConfig,
  state: ConsentState,
): void {
  const encoded = encodeURIComponent(JSON.stringify(state));
  const expires = new Date(
    Date.parse(state.updatedAt) + config.expiresDays * 24 * 60 * 60 * 1000,
  );
  writeCookie(config, encoded, expires);
  writeMirror(config.cookieName, encoded);
}

export function reconcileStored(
  config: NormalizedStorageConfig,
  stored: ReturnType<typeof readStored>,
): void {
  if (!stored.decision) {
    return;
  }
  if (stored.source === "cookie") {
    if (stored.mirror?.encoded !== stored.decision.encoded) {
      writeMirror(config.cookieName, stored.decision.encoded);
    }
    return;
  }
  const expires = new Date(
    Date.parse(stored.decision.state.updatedAt) +
      config.expiresDays * 24 * 60 * 60 * 1000,
  );
  writeCookie(config, stored.decision.encoded, expires);
}

export function clearStored(config: NormalizedStorageConfig): void {
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: synchronous cookie removal is required for Safari 15.4.
    document.cookie = `${encodeURIComponent(config.cookieName)}=; ${cookieAttributes(
      config,
      new Date(0),
    )}`;
  } catch {
    // Test cleanup remains best-effort.
  }
  try {
    window.localStorage.removeItem(config.cookieName);
  } catch {
    // Test cleanup remains best-effort.
  }
}
