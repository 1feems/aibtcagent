import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

interface HeartbeatOrientation {
  btcAddress?: string;
  displayName?: string;
  level?: number;
  levelName?: string;
  lastActiveAt?: string;
  checkInCount?: number;
  unreadCount?: number;
}

interface HeartbeatResponse {
  orientation?: HeartbeatOrientation;
}

interface HeartbeatState {
  address: string;
  lastCheckedAt: string;
  lastCheckInCount: number | null;
  lastActiveAt: string | null;
}

interface HeartbeatReport {
  kind: "heartbeat_reminder";
  address: string;
  checkedAt: string;
  checkInCount: number | null;
  previousCheckInCount: number | null;
  delta: number | null;
  reminderNeeded: boolean;
  lastActiveAt: string | null;
  displayName: string | null;
  levelName: string | null;
  note: string;
}

function resolvePath(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

async function readJsonFile<T>(relativePath: string): Promise<T | null> {
  try {
    const raw = await readFile(resolvePath(relativePath), "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJsonFile(relativePath: string, data: unknown): Promise<string> {
  const filePath = resolvePath(relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  return filePath;
}

async function writeTextFile(relativePath: string, text: string): Promise<string> {
  const filePath = resolvePath(relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, text, "utf8");
  return filePath;
}

function renderMarkdown(report: HeartbeatReport): string {
  const deltaLabel =
    report.delta === null ? "unknown" : report.delta > 0 ? `+${report.delta}` : `${report.delta}`;

  return [
    `# Heartbeat Reminder: ${report.checkedAt.slice(0, 10)}`,
    "",
    `Checked at: ${report.checkedAt}`,
    `Address: ${report.address}`,
    `Display name: ${report.displayName ?? "unknown"}`,
    `Level: ${report.levelName ?? "unknown"}`,
    `Current checkInCount: ${report.checkInCount ?? "unknown"}`,
    `Previous checkInCount: ${report.previousCheckInCount ?? "unknown"}`,
    `Delta: ${deltaLabel}`,
    `Last active at: ${report.lastActiveAt ?? "unknown"}`,
    `Reminder needed: ${report.reminderNeeded ? "yes" : "no"}`,
    "",
    `Note: ${report.note}`,
    ""
  ].join("\n");
}

async function fetchHeartbeat(address: string): Promise<HeartbeatResponse> {
  const url = `https://aibtc.com/api/heartbeat?address=${address}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Heartbeat endpoint returned ${response.status}`);
  }
  return response.json() as Promise<HeartbeatResponse>;
}

export async function generateHeartbeatReminder(
  address: string,
  checkedAt: string
): Promise<{ report: HeartbeatReport; state: HeartbeatState }> {
  const previousState =
    (await readJsonFile<HeartbeatState>("data/state/heartbeat-status.json")) ?? null;
  const heartbeat = await fetchHeartbeat(address);
  const orientation = heartbeat.orientation ?? {};
  const checkInCount =
    typeof orientation.checkInCount === "number" ? orientation.checkInCount : null;
  const previousCount =
    previousState?.address === address ? previousState.lastCheckInCount : null;
  const delta =
    checkInCount === null || previousCount === null ? null : checkInCount - previousCount;
  const reminderNeeded =
    previousCount !== null && checkInCount !== null ? checkInCount <= previousCount : false;

  const report: HeartbeatReport = {
    kind: "heartbeat_reminder",
    address,
    checkedAt,
    checkInCount,
    previousCheckInCount: previousCount,
    delta,
    reminderNeeded,
    lastActiveAt: orientation.lastActiveAt ?? null,
    displayName: orientation.displayName ?? null,
    levelName: orientation.levelName ?? null,
    note: reminderNeeded
      ? "checkInCount did not increase since the last reminder run — complete a manual heartbeat/check-in today."
      : "checkInCount increased since the last reminder run or this is the first recorded baseline."
  };

  const state: HeartbeatState = {
    address,
    lastCheckedAt: checkedAt,
    lastCheckInCount: checkInCount,
    lastActiveAt: orientation.lastActiveAt ?? null
  };

  return { report, state };
}

export async function saveHeartbeatReminder(
  report: HeartbeatReport,
  state: HeartbeatState
): Promise<{ jsonPath: string; markdownPath: string; statePath: string }> {
  const date = report.checkedAt.slice(0, 10);
  const jsonPath = await writeJsonFile(`data/reports/heartbeat/${date}.json`, report);
  const markdownPath = await writeTextFile(
    `data/reports/heartbeat/${date}.md`,
    renderMarkdown(report)
  );
  const statePath = await writeJsonFile("data/state/heartbeat-status.json", state);

  return { jsonPath, markdownPath, statePath };
}

async function main(): Promise<void> {
  const address = process.env.AIBTC_BITCOIN_ADDRESS ?? "";
  if (!address) {
    throw new Error("AIBTC_BITCOIN_ADDRESS is required");
  }

  const checkedAt = new Date().toISOString();
  const { report, state } = await generateHeartbeatReminder(address, checkedAt);
  const paths = await saveHeartbeatReminder(report, state);
  process.stdout.write(`${JSON.stringify({ report, paths }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  void main();
}
