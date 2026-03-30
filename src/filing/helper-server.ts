import { createServer, type IncomingMessage } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recordFiledSignal } from "./state.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

function parseArgs(argv: string[]): { port: number } {
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.set(key, "true");
      continue;
    }

    parsed.set(key, next);
    index += 1;
  }

  return {
    port: Number(parsed.get("port") ?? "4173")
  };
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function serveStatic(pathname: string): Promise<{ status: number; body: Buffer; contentType: string }> {
  const root = resolve(process.cwd(), "tools/xverse-register");
  const relativePath = pathname === "/" ? "/index.html" : pathname.replace(/^\/tools\/xverse-register/, "") || "/index.html";
  const safePath = normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath.startsWith("/") ? safePath.slice(1) : safePath);
  const body = await readFile(filePath);
  const contentType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
  return { status: 200, body, contentType };
}

export async function startFilingHelperServer(port: number): Promise<void> {
  await mkdir(resolve(process.cwd(), "data/filing-results"), { recursive: true });

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

      if (req.method === "GET" && url.pathname === "/api/local/filing-ready") {
        const reportDate = url.searchParams.get("date");
        const candidateId = url.searchParams.get("candidate");

        if (!reportDate || !candidateId) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify(
              {
                error: "Missing required date and candidate query params."
              },
              null,
              2
            )
          );
          return;
        }

        const artifactPath = resolve(
          process.cwd(),
          `data/filing-ready/${reportDate}/${candidateId}.json`
        );
        const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as unknown;

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ artifactPath, artifact }, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/filed-signal") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          reportDate?: string;
          candidateId: string;
          signalId: string;
          filedAt?: string;
          headline?: string | null;
          beat?: string | null;
          apiResponse?: unknown;
        };

        const result = await recordFiledSignal({
          reportDate: payload.reportDate,
          candidateId: payload.candidateId,
          signalId: payload.signalId,
          filedAt: payload.filedAt,
          headline: payload.headline,
          beat: payload.beat,
          apiResponse: payload.apiResponse
        });

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      const { status, body, contentType } = await serveStatic(url.pathname);
      res.writeHead(status, { "Content-Type": contentType });
      res.end(body);
    } catch (error) {
      const status = (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify(
          {
            error: (error as Error).message
          },
          null,
          2
        )
      );
    }
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(port, "127.0.0.1", () => resolvePromise());
  });

  process.stdout.write(
    `[filing-helper] serving Xverse helper at http://127.0.0.1:${port}/tools/xverse-register/file-signal.html\n`
  );
}

async function main(): Promise<void> {
  const { port } = parseArgs(process.argv.slice(2));
  await startFilingHelperServer(port);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
