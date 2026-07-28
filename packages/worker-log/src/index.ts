// SPDX-License-Identifier: MIT
const MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_RETENTION_DAYS = 395;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const RECEIPT_FIELDS = new Set([
  "consentId",
  "host",
  "revision",
  "categories",
  "ts",
  "action",
]);

type ReceiptAction = "consent" | "change" | "withdraw";

interface ReceiptPayload {
  consentId: string;
  host: string;
  revision: number;
  categories: Record<string, boolean>;
  ts: string;
  action: ReceiptAction;
}

interface ReceiptRow {
  consent_id: string;
  host: string;
  revision: number;
  categories: string;
  ts: string;
  action: ReceiptAction;
  received_at: string;
}

function jsonResponse(
  body: unknown,
  status: number,
  origin?: string,
): Response {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(
  status: number,
  message: string,
  origin?: string,
): Response {
  return jsonResponse({ error: message }, status, origin);
}

function configuredOrigins(value: string): Set<string> {
  const origins = new Set<string>();
  for (const candidate of value.split(",")) {
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = new URL(trimmed);
      if (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        parsed.origin === trimmed
      ) {
        origins.add(trimmed);
      }
    } catch {
      // Invalid configured origins are ignored and therefore never allowed.
    }
  }
  return origins;
}

function allowedOrigin(request: Request, env: Env): string | undefined {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return undefined;
  }
  return configuredOrigins(env.ALLOWED_ORIGINS).has(origin)
    ? origin
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function validatePayload(value: unknown): ReceiptPayload | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const keys = Object.keys(value);
  if (
    keys.length !== RECEIPT_FIELDS.size ||
    keys.some((key) => !RECEIPT_FIELDS.has(key))
  ) {
    return undefined;
  }
  if (
    typeof value.consentId !== "string" ||
    !UUID_V4.test(value.consentId) ||
    typeof value.host !== "string" ||
    value.host.length === 0 ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) <= 0 ||
    !isRecord(value.categories) ||
    Object.keys(value.categories).length === 0 ||
    Object.values(value.categories).some(
      (categoryValue) => typeof categoryValue !== "boolean",
    ) ||
    !isTimestamp(value.ts) ||
    (value.action !== "consent" &&
      value.action !== "change" &&
      value.action !== "withdraw")
  ) {
    return undefined;
  }
  return value as unknown as ReceiptPayload;
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    (/^\d+$/.test(contentLength) === false ||
      Number(contentLength) > MAX_BODY_BYTES)
  ) {
    throw new RangeError("Request body exceeds 16 KiB.");
  }
  if (!request.body) {
    throw new SyntaxError("Missing request body.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("Request body exceeds 16 KiB.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

async function handlePost(request: Request, env: Env): Promise<Response> {
  const origin = allowedOrigin(request, env);
  if (!origin) {
    return errorResponse(403, "Origin is not allowed.");
  }
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return errorResponse(415, "Content-Type must be application/json.", origin);
  }

  let value: unknown;
  try {
    value = await readJsonBody(request);
  } catch (error) {
    return errorResponse(
      error instanceof RangeError ? 413 : 400,
      error instanceof RangeError
        ? "Request body exceeds 16 KiB."
        : "Request body must contain valid JSON.",
      origin,
    );
  }
  const receipt = validatePayload(value);
  if (!receipt) {
    return errorResponse(400, "Receipt payload is invalid.", origin);
  }
  if (new URL(origin).host !== receipt.host) {
    return errorResponse(
      400,
      "Receipt host must match the allowed Origin host.",
      origin,
    );
  }

  const { success } = await env.RECEIPT_RATE_LIMITER.limit({
    key: `${origin}\n${receipt.consentId}`,
  });
  if (!success) {
    return errorResponse(429, "Receipt rate limit exceeded.", origin);
  }

  const receivedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO consent_receipts
      (consent_id, host, revision, categories, ts, action, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      receipt.consentId,
      receipt.host,
      receipt.revision,
      JSON.stringify(receipt.categories),
      receipt.ts,
      receipt.action,
      receivedAt,
    )
    .run();

  return jsonResponse({ stored: true }, 201, origin);
}

function handleOptions(request: Request, env: Env): Response {
  const origin = allowedOrigin(request, env);
  if (!origin) {
    return errorResponse(403, "Origin is not allowed.");
  }
  const headers = new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "access-control-max-age": "86400",
    vary: "Origin",
  });
  return new Response(null, { status: 204, headers });
}

async function secureTokenMatches(
  supplied: string,
  expected: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [suppliedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const suppliedBytes = new Uint8Array(suppliedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = suppliedBytes.length ^ expectedBytes.length;
  for (let index = 0; index < suppliedBytes.length; index += 1) {
    difference |= (suppliedBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  if (!env.AUDIT_BEARER_TOKEN) {
    return false;
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }
  return secureTokenMatches(
    authorization.slice("Bearer ".length),
    env.AUDIT_BEARER_TOKEN,
  );
}

async function handleGet(
  request: Request,
  env: Env,
  consentId: string,
): Promise<Response> {
  if (!(await isAuthorized(request, env))) {
    return errorResponse(401, "Unauthorized.");
  }
  if (!UUID_V4.test(consentId)) {
    return errorResponse(400, "Consent ID must be a UUIDv4.");
  }
  const result = await env.DB.prepare(
    `SELECT consent_id, host, revision, categories, ts, action, received_at
       FROM consent_receipts
      WHERE consent_id = ?
      ORDER BY received_at ASC, id ASC`,
  )
    .bind(consentId)
    .all<ReceiptRow>();

  return jsonResponse(
    {
      consentId,
      receipts: result.results.map((row) => ({
        consentId: row.consent_id,
        host: row.host,
        revision: row.revision,
        categories: JSON.parse(row.categories) as Record<string, boolean>,
        ts: row.ts,
        action: row.action,
        receivedAt: row.received_at,
      })),
    },
    200,
  );
}

function retentionDays(value: string | undefined): number {
  if (value === undefined || value === "") {
    return DEFAULT_RETENTION_DAYS;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error("RETENTION_DAYS must be an integer from 1 to 3650.");
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < MIN_RETENTION_DAYS ||
    parsed > MAX_RETENTION_DAYS
  ) {
    throw new Error("RETENTION_DAYS must be an integer from 1 to 3650.");
  }
  return parsed;
}

async function fetchHandler(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (url.pathname === "/receipt") {
      if (request.method === "POST") {
        return await handlePost(request, env);
      }
      if (request.method === "OPTIONS") {
        return handleOptions(request, env);
      }
      return errorResponse(405, "Method not allowed.");
    }

    const match = /^\/receipts\/([^/]+)$/.exec(url.pathname);
    if (request.method === "GET" && match?.[1]) {
      return await handleGet(request, env, decodeURIComponent(match[1]));
    }
    return errorResponse(404, "Not found.");
  } catch {
    return errorResponse(500, "Internal server error.");
  }
}

async function scheduledHandler(
  controller: ScheduledController,
  env: Env,
): Promise<void> {
  const cutoff = new Date(
    controller.scheduledTime -
      retentionDays(env.RETENTION_DAYS) * 24 * 60 * 60 * 1000,
  ).toISOString();
  await env.DB.prepare("DELETE FROM consent_receipts WHERE received_at < ?")
    .bind(cutoff)
    .run();
}

/**
 * Minimum scheduled-event surface used by the packaged Worker.
 */
export interface WorkerLogScheduledEvent {
  /** Scheduled execution time in milliseconds since the Unix epoch. */
  readonly scheduledTime: number;
}

/**
 * Importable module shape of the packaged Worker.
 *
 * Wrangler supplies the concrete bindings at runtime. Keeping the public type
 * environment-agnostic lets TypeScript consumers import the package without
 * installing Cloudflare's ambient Worker types.
 */
export interface WorkerLogModule {
  /** Handles receipt writes and authenticated audit reads. */
  fetch(request: Request, env: unknown): Promise<Response>;
  /** Purges receipts older than the configured server-time retention window. */
  scheduled(controller: WorkerLogScheduledEvent, env: unknown): Promise<void>;
}

/**
 * Optional libreconsent receipt Worker.
 */
const worker: WorkerLogModule = {
  fetch: (request, env) => fetchHandler(request, env as Env),
  scheduled: (controller, env) =>
    scheduledHandler(controller as ScheduledController, env as Env),
};

export default worker;
