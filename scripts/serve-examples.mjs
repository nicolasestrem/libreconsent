import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, relative, resolve } from "node:path";

const examplesRoot = resolve(process.cwd(), "examples");
const headSnippetPath = resolve(
  process.cwd(),
  process.env.LIBRECONSENT_HEAD_SNIPPET_PATH ??
    "packages/core/dist/head-snippet.global.js",
);
const headSnippetMarker = "<!-- LIBRECONSENT_HEAD_SNIPPET -->";
// Fixtures load the built IIFE bundles the same way a host page would.
const artifactRoutes = new Map([
  [
    "/dist/bridge.global.js",
    {
      path: resolve(
        process.cwd(),
        process.env.LIBRECONSENT_BRIDGE_ARTIFACT_PATH ??
          "packages/bridge/dist/index.global.js",
      ),
      missingMessage:
        "Bridge browser artifact is unavailable. Run pnpm build first.",
    },
  ],
  [
    "/dist/core.global.js",
    {
      path: resolve(
        process.cwd(),
        process.env.LIBRECONSENT_CORE_ARTIFACT_PATH ??
          "packages/core/dist/index.global.js",
      ),
      missingMessage:
        "Core browser artifact is unavailable. Run pnpm build first.",
    },
  ],
  [
    "/dist/ui.global.js",
    {
      path: resolve(
        process.cwd(),
        process.env.LIBRECONSENT_UI_ARTIFACT_PATH ??
          "packages/ui/dist/index.global.js",
      ),
      missingMessage:
        "UI browser artifact is unavailable. Run pnpm build first.",
    },
  ],
]);
// Fixtures are served outside dist/, so a sourcemap comment would only 404.
const sourceMappingComment = /\n?\/\/# sourceMappingURL=.*$/m;
const port = Number(process.env.PORT ?? "4173");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
  });
  response.end(message);
}

function resolveFixturePath(decodedPathname) {
  const relativePath =
    decodedPathname === "/"
      ? "basic-site/index.html"
      : decodedPathname.replace(/^\/+/, "");
  const requestedPath = relativePath.endsWith("/")
    ? `${relativePath}index.html`
    : relativePath;
  const filePath = resolve(examplesRoot, requestedPath);

  if (
    relative(examplesRoot, filePath).startsWith("..") ||
    filePath === examplesRoot
  ) {
    return null;
  }

  return filePath;
}

const server = createServer(async (request, response) => {
  if (!request.url || request.method !== "GET") {
    sendText(response, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
  } catch {
    sendText(response, 400, "Bad request");
    return;
  }

  const artifact = artifactRoutes.get(pathname);
  if (artifact) {
    let source;
    try {
      source = (await readFile(artifact.path, "utf8")).replace(
        sourceMappingComment,
        "",
      );
    } catch {
      sendText(response, 500, artifact.missingMessage);
      return;
    }
    response.writeHead(200, { "content-type": mimeTypes[".js"] });
    response.end(source);
    return;
  }

  if (pathname === "/api/region") {
    const regionHeader = request.headers["cf-ipcountry"];
    const region =
      typeof regionHeader === "string" && regionHeader.trim() !== ""
        ? regionHeader.trim().toUpperCase()
        : "US-CA";
    response.writeHead(200, {
      "cache-control": "private, max-age=300",
      "content-type": "application/json; charset=utf-8",
      vary: "CF-IPCountry",
    });
    response.end(JSON.stringify({ region }));
    return;
  }

  const filePath = resolveFixturePath(pathname);
  if (!filePath) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    await access(filePath);
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }
  } catch {
    sendText(response, 404, "Not found");
    return;
  }

  const contentType =
    mimeTypes[extname(filePath)] ?? "application/octet-stream";
  if (contentType !== "text/html; charset=utf-8") {
    response.writeHead(200, { "content-type": contentType });
    createReadStream(filePath).pipe(response);
    return;
  }

  const html = await readFile(filePath, "utf8");
  if (!html.includes(headSnippetMarker)) {
    response.writeHead(200, { "content-type": contentType });
    response.end(html);
    return;
  }

  let headSnippet;
  try {
    headSnippet = (await readFile(headSnippetPath, "utf8")).replace(
      sourceMappingComment,
      "",
    );
  } catch {
    sendText(
      response,
      500,
      "Consent Mode head artifact is unavailable. Run pnpm build first.",
    );
    return;
  }
  response.writeHead(200, { "content-type": contentType });
  response.end(
    html.replace(
      headSnippetMarker,
      `<script data-libreconsent-head-artifact>${headSnippet}</script>`,
    ),
  );
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving example fixtures at http://127.0.0.1:${port}`);
});
