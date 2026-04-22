import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AuditLogRecord } from "./types.js";

export function createAuditRunId(prefix = "audit"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

export async function writeAuditLog(runId: string, record: AuditLogRecord, root = process.cwd()): Promise<string> {
  const logPath = resolve(root, "logs", `${runId}.json`);
  await mkdir(dirname(logPath), { recursive: true });
  await writeFile(logPath, JSON.stringify(record, null, 2) + "\n", "utf8");
  return logPath;
}
