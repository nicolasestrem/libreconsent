import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, relative, resolve } from "node:path";

const examplesRoot = resolve(process.cwd(), "examples");
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

function resolveFixturePath(requestUrl) {
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  const decodedPathname = decodeURIComponent(pathname);
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

  let filePath;
  try {
    filePath = resolveFixturePath(request.url);
  } catch {
    sendText(response, 400, "Bad request");
    return;
  }

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

  response.writeHead(200, {
    "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving example fixtures at http://127.0.0.1:${port}`);
});
