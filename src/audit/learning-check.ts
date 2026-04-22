import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { updatePatternMemory } from "./memory.js";
import type { LearningAuditResult } from "./types.js";

const LEARNING_CONTRACT_PATHS = [
  "src/audit/memory.ts",
  "src/audit/types.ts",
  "src/learning/outcome-feedback.ts",
  "src/learning/editorial-memory.ts",
  "src/loop/daily-learn.ts"
] as const;

export async function auditLearning(root = process.cwd()): Promise<LearningAuditResult> {
  const issues: string[] = [];
  const checkedPaths = LEARNING_CONTRACT_PATHS.map((relativePath) => resolve(root, relativePath));

  const [auditMemoryContent, auditTypesContent, outcomeFeedbackContent, editorialMemoryContent, dailyLearnContent] = await Promise.all(
    checkedPaths.map((absolutePath) => readFile(absolutePath, "utf8"))
  );

  if (!/failureToPattern\(|updatePatternMemory\(/.test(auditMemoryContent)) {
    issues.push("audit-memory: missing controlled pattern update flow");
  }
  if (!/interface PatternMemoryRecord[\s\S]*pattern:\s*string;[\s\S]*count:\s*number;/.test(auditTypesContent)) {
    issues.push("audit-memory: pattern memory schema is not explicit");
  }
  if (!/repeatedLabels|labelCounts/.test(outcomeFeedbackContent)) {
    issues.push("outcome-feedback: repeated label learning path is missing");
  }
  if (!/refreshOutcomeFeedbackMemory\(|syncPromotedChecksSection\(|memory\/learnings\.md/.test(editorialMemoryContent)) {
    issues.push("editorial-memory: outcome feedback is not promoted into editorial memory");
  }
  if (!/runOutcomeChecker\(|refreshLearningCache\(|daily-learn/.test(dailyLearnContent)) {
    issues.push("daily-learn: learning refresh path is incomplete");
  }

  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-learning-audit-"));
  try {
    const memoryPath = resolve(tempDir, "patterns.json");
    const patterns = await updatePatternMemory(memoryPath, ["missing_evidence", "missing_evidence", "constraint_violation"]);
    const stored = JSON.parse(await readFile(memoryPath, "utf8")) as Array<Record<string, unknown>>;

    const validShape = stored.every((entry) => {
      const keys = Object.keys(entry).sort();
      return keys.length === 2 && keys[0] === "count" && keys[1] === "pattern";
    });
    if (!validShape) {
      issues.push("audit-memory: stored learning entries contain fields beyond pattern/count");
    }
    if (patterns[0]?.pattern !== "missing evidence -> fail" || patterns[0]?.count !== 2) {
      issues.push("audit-memory: controlled pattern aggregation did not preserve expected counts");
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  return {
    learning: issues.length === 0,
    issues,
    checked_paths: checkedPaths
  };
}
