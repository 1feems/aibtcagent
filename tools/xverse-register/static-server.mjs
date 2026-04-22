import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const host = "127.0.0.1";
const port = 4173;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function resolvePath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const normalized = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(root, normalized);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/favicon.ico" || req.url === "/tools/xverse-register/favicon.ico") {
      res.writeHead(204, { "Content-Type": "image/x-icon" });
      res.end();
      return;
    }

    let filePath = resolvePath(req.url ?? "/");
    const fileStat = await stat(filePath).catch(() => null);

    if (fileStat?.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`[xverse-static] serving ${root} at http://${host}:${port}/tools/xverse-register/heartbeat.html`);
});
