import { createScheduledController } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import worker from "./index";

const ORIGIN = "https://app.example.test";
const TOKEN = "local-test-bearer-token";
const CONSENT_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM consent_receipts").run();
});

function receipt(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    consentId: CONSENT_ID,
    host: "app.example.test",
    revision: 1,
    categories: { analytics: true, marketing: false },
    ts: "2026-07-27T10:00:00.000Z",
    action: "consent",
    ...overrides,
  };
}

async function dispatch(request: Request): Promise<Response> {
  return worker.fetch(request, env);
}

function post(
  body: unknown = receipt(),
  headers: Record<string, string> = {},
): Promise<Response> {
  return dispatch(
    new Request("https://worker.example.test/receipt", {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

function get(consentId = CONSENT_ID, token = TOKEN): Promise<Response> {
  return dispatch(
    new Request(
      `https://worker.example.test/receipts/${encodeURIComponent(consentId)}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    ),
  );
}

describe("D1 migration", () => {
  test("creates only the approved receipt columns and indexes", async () => {
    const columns = await env.DB.prepare(
      "PRAGMA table_info(consent_receipts)",
    ).all<{ name: string }>();
    expect(columns.results.map((column) => column.name)).toEqual([
      "id",
      "consent_id",
      "host",
      "revision",
      "categories",
      "ts",
      "action",
      "received_at",
    ]);

    const indexes = await env.DB.prepare(
      "PRAGMA index_list(consent_receipts)",
    ).all<{ name: string }>();
    expect(indexes.results.map((index) => index.name).sort()).toEqual([
      "consent_receipts_audit_idx",
      "consent_receipts_purge_idx",
    ]);
    expect(
      columns.results.some((column) =>
        /ip|user_agent|fingerprint|region|header/i.test(column.name),
      ),
    ).toBe(false);
  });
});

describe("POST /receipt", () => {
  test("rejects missing, null, and unlisted origins without CORS", async () => {
    for (const origin of [undefined, "null", "https://other.example.test"]) {
      const headers = new Headers({ "content-type": "application/json" });
      if (origin !== undefined) {
        headers.set("origin", origin);
      }
      const response = await dispatch(
        new Request("https://worker.example.test/receipt", {
          method: "POST",
          headers,
          body: JSON.stringify(receipt()),
        }),
      );
      expect(response.status).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  test("returns an allowed-origin CORS preflight", async () => {
    const response = await dispatch(
      new Request("https://worker.example.test/receipt", {
        method: "OPTIONS",
        headers: { origin: ORIGIN },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "POST, OPTIONS",
    );
  });

  test("requires JSON and caps the body at 16 KiB", async () => {
    const wrongType = await post(receipt(), {
      "content-type": "text/plain",
    });
    expect(wrongType.status).toBe(415);

    const oversized = await post({
      ...receipt(),
      padding: "x".repeat(16 * 1024),
    });
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  test.each([
    ["unknown field", { ...receipt(), ip: "192.0.2.1" }],
    ["missing field", { ...receipt(), action: undefined }],
    [
      "non-v4 UUID",
      receipt({ consentId: "550e8400-e29b-11d4-a716-446655440000" }),
    ],
    ["zero revision", receipt({ revision: 0 })],
    ["fractional revision", receipt({ revision: 1.5 })],
    ["empty categories", receipt({ categories: {} })],
    ["non-boolean category", receipt({ categories: { analytics: 1 } })],
    ["non-ISO timestamp", receipt({ ts: "2026-07-27" })],
    ["invalid timestamp", receipt({ ts: "2026-02-30T10:00:00.000Z" })],
    ["invalid action", receipt({ action: "restore" })],
  ])("rejects %s", async (_name, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  test("requires the payload host to match the allowed Origin host", async () => {
    const response = await post(receipt({ host: "other.example.test" }));
    expect(response.status).toBe(400);
  });

  test("stores a valid receipt with server-controlled received_at", async () => {
    const response = await post();
    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ stored: true });

    const stored = await env.DB.prepare(
      "SELECT * FROM consent_receipts WHERE consent_id = ?",
    )
      .bind(CONSENT_ID)
      .first<Record<string, unknown>>();
    expect(stored).toMatchObject({
      consent_id: CONSENT_ID,
      host: "app.example.test",
      revision: 1,
      categories: '{"analytics":true,"marketing":false}',
      ts: "2026-07-27T10:00:00.000Z",
      action: "consent",
    });
    expect(stored?.received_at).toMatch(ISO_TIMESTAMP);
    expect(stored).not.toHaveProperty("ip");
    expect(stored).not.toHaveProperty("user_agent");
    expect(stored).not.toHaveProperty("fingerprint");
  });

  test("limits each Origin and consent ID to 30 requests per minute", async () => {
    const id = "8d41ad4e-32de-4e5b-9c88-a279bb5ee30a";
    const statuses: number[] = [];
    for (let index = 0; index < 31; index += 1) {
      statuses.push((await post(receipt({ consentId: id }))).status);
    }
    expect(statuses.slice(0, 30)).toEqual(Array(30).fill(201));
    expect(statuses[30]).toBe(429);
  });
});

describe("GET /receipts/:consentId", () => {
  test("requires the configured bearer token", async () => {
    const missing = await dispatch(
      new Request(`https://worker.example.test/receipts/${CONSENT_ID}`),
    );
    const wrong = await get(CONSENT_ID, "wrong-token");
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(missing.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("rejects a malformed consent ID after authorization", async () => {
    expect((await get("not-a-uuid")).status).toBe(400);
  });

  test("returns an empty trail for an unknown consent ID", async () => {
    const response = await get("62b32f93-f989-4af5-906a-80d7c265141e");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      consentId: "62b32f93-f989-4af5-906a-80d7c265141e",
      receipts: [],
    });
  });

  test("returns an ascending trail with only documented fields", async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO consent_receipts
          (consent_id, host, revision, categories, ts, action, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        CONSENT_ID,
        "app.example.test",
        2,
        '{"analytics":false}',
        "2026-07-27T11:00:00.000Z",
        "withdraw",
        "2026-07-27T11:00:01.000Z",
      ),
      env.DB.prepare(
        `INSERT INTO consent_receipts
          (consent_id, host, revision, categories, ts, action, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        CONSENT_ID,
        "app.example.test",
        1,
        '{"analytics":true}',
        "2026-07-27T10:00:00.000Z",
        "consent",
        "2026-07-27T10:00:01.000Z",
      ),
    ]);

    const response = await get();
    const body = (await response.json()) as {
      receipts: Array<Record<string, unknown>>;
    };
    expect(response.status).toBe(200);
    expect(body.receipts.map((item) => item.revision)).toEqual([1, 2]);
    expect(Object.keys(body.receipts[0] ?? {}).sort()).toEqual([
      "action",
      "categories",
      "consentId",
      "host",
      "receivedAt",
      "revision",
      "ts",
    ]);
    for (const item of body.receipts) {
      expect(item).not.toHaveProperty("ip");
      expect(item).not.toHaveProperty("userAgent");
      expect(item).not.toHaveProperty("user_agent");
      expect(item).not.toHaveProperty("fingerprint");
      expect(item).not.toHaveProperty("region");
      expect(item).not.toHaveProperty("headers");
    }
  });
});

describe("scheduled retention purge", () => {
  test("uses scheduledTime and the configured retention period", async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO consent_receipts
          (consent_id, host, revision, categories, ts, action, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        CONSENT_ID,
        "app.example.test",
        1,
        "{}",
        "2025-06-26T23:59:59.999Z",
        "consent",
        "2025-06-26T23:59:59.999Z",
      ),
      env.DB.prepare(
        `INSERT INTO consent_receipts
          (consent_id, host, revision, categories, ts, action, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        CONSENT_ID,
        "app.example.test",
        2,
        "{}",
        "2025-06-27T00:00:00.000Z",
        "change",
        "2025-06-27T00:00:00.000Z",
      ),
    ]);

    await worker.scheduled(
      createScheduledController({
        scheduledTime: Date.parse("2026-07-27T00:00:00.000Z"),
        cron: "0 0 * * *",
      }),
      env,
    );

    const rows = await env.DB.prepare(
      "SELECT received_at FROM consent_receipts ORDER BY received_at",
    ).all<{ received_at: string }>();
    expect(rows.results).toEqual([{ received_at: "2025-06-27T00:00:00.000Z" }]);
  });
});

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
