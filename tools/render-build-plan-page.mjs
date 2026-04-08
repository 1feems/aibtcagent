import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT_PATH = resolve(ROOT, "docs/build-plan.md");
const SITE_DIR = resolve(ROOT, "site");
const BUILD_PLAN_DIR = resolve(SITE_DIR, "build-plan");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildPage(markdown) {
  const escaped = escapeHtml(markdown);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AIBTC Build Plan</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1020;
      --panel: #121a31;
      --line: #27314f;
      --text: #f4f7ff;
      --muted: #98a7cf;
      --accent: #7dd3fc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(180deg, #0b1020 0%, #101933 100%);
      color: var(--text);
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 40px 20px 64px;
    }
    .hero {
      margin-bottom: 24px;
      padding: 24px;
      background: rgba(18, 26, 49, 0.92);
      border: 1px solid var(--line);
      border-radius: 18px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 2rem;
      line-height: 1.1;
    }
    p {
      margin: 0;
      color: var(--muted);
    }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .actions a {
      color: #001018;
      background: var(--accent);
      text-decoration: none;
      font-weight: 700;
      padding: 10px 14px;
      border-radius: 999px;
    }
    .actions a.secondary {
      color: var(--text);
      background: transparent;
      border: 1px solid var(--line);
    }
    pre {
      margin: 0;
      padding: 24px;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text);
      background: rgba(18, 26, 49, 0.92);
      border: 1px solid var(--line);
      border-radius: 18px;
      overflow: auto;
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>AIBTC Build Plan</h1>
      <p>Published from <code>docs/build-plan.md</code> so the current plan is visible on GitHub Pages, not just in the repo.</p>
      <div class="actions">
        <a href="./build-plan.md">View Raw Markdown</a>
        <a class="secondary" href="../">Open Site Root</a>
      </div>
    </section>
    <pre>${escaped}</pre>
  </main>
</body>
</html>
`;
}

async function main() {
  const markdown = await readFile(INPUT_PATH, "utf8");
  await mkdir(BUILD_PLAN_DIR, { recursive: true });
  await writeFile(resolve(BUILD_PLAN_DIR, "build-plan.md"), markdown, "utf8");
  await writeFile(resolve(BUILD_PLAN_DIR, "index.html"), buildPage(markdown), "utf8");
  await writeFile(
    resolve(SITE_DIR, "index.html"),
    '<!doctype html><meta http-equiv="refresh" content="0; url=./build-plan/"><title>AIBTC Build Plan</title>',
    "utf8"
  );
  await writeFile(resolve(SITE_DIR, ".nojekyll"), "", "utf8");
}

await main();
