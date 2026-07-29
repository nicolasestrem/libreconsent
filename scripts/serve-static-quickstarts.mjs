// SPDX-License-Identifier: MIT
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, relative, resolve } from "node:path";

const staticRoot = resolve(
  process.cwd(),
  process.env.LIBRECONSENT_STATIC_ROOT ?? "examples",
);
const port = Number(process.env.PORT ?? "4174");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
  });
  response.end(message);
}

function resolveStaticPath(decodedPathname) {
  const relativePath =
    decodedPathname === "/"
      ? "quickstarts/basic-consent-mode/index.html"
      : decodedPathname.replace(/^\/+/, "");
  const requestedPath = relativePath.endsWith("/")
    ? `${relativePath}index.html`
    : relativePath;
  const filePath = resolve(staticRoot, requestedPath);

  if (
    relative(staticRoot, filePath).startsWith("..") ||
    filePath === staticRoot
  ) {
    return null;
  }

  return filePath;
}

const server = createServer(async (request, response) => {
  if (!request.url || (request.method !== "GET" && request.method !== "HEAD")) {
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

  const filePath = resolveStaticPath(pathname);
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
  response.writeHead(200, { "content-type": contentType });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving static quickstarts at http://127.0.0.1:${port}`);
});
