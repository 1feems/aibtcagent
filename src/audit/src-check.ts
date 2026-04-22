import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SrcAuditResult } from "./types.js";

export async function auditSourceFile(filePath: string): Promise<SrcAuditResult> {
  const content = await readFile(filePath, "utf8");
  const loop_found = /while\s*\(\s*true\s*\)/.test(content);
  const evaluation_called = /evaluateAuditOutput\(|validateAuditOutput\(/.test(content);
  const memory_violation = /updatePatternMemory\(|writePatternMemory\(|memory\/|memoryPath/i.test(content);

  return {
    loop_found,
    evaluation_called,
    memory_violation
  };
}

export async function auditSrc(root = process.cwd()): Promise<SrcAuditResult> {
  const target = resolve(root, "src/audit/loop.ts");
  return auditSourceFile(target);
}
