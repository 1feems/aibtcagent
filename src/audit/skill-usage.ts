import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SkillUsageAuditResult } from "./types.js";

interface RepoSkillContract {
  name: string;
  paths: string[];
  requiredPatterns: RegExp[];
}

const REPO_SKILL_CONTRACTS: RepoSkillContract[] = [
  {
    name: "create-signal",
    paths: [
      "src/prep/candidate-generator.ts",
      "src/agent/run-signal-loop.ts"
    ],
    requiredPatterns: [
      /runAuditedLoop\(/,
      /CLAIM:/,
      /EVIDENCE:/,
      /IMPLICATION:/
    ]
  },
  {
    name: "record-signal-outcome",
    paths: [
      "src/loop/daily-learn.ts",
      "src/learning/outcome-feedback.ts"
    ],
    requiredPatterns: [
      /runOutcomeChecker\(/,
      /refreshOutcomeFeedbackMemory|inferFeedbackLabels/,
      /daily-learn/,
      /feedbackLabels|learningWhy/
    ]
  },
  {
    name: "analyze-signal-outcomes",
    paths: [
      "src/learning/outcome-feedback.ts",
      "src/learning/editorial-memory.ts",
      "src/agent/run-signal-loop.ts"
    ],
    requiredPatterns: [
      /repeatedLabels|labelCounts/,
      /editorial-memory/i,
      /learnings\.md/,
      /lesson|pattern|outcome/i
    ]
  }
];

const RAW_LLM_PATTERN = /openai|anthropic|chat\.completions|responses\.create/i;

export async function auditSkillUsage(root = process.cwd()): Promise<SkillUsageAuditResult> {
  const issues: string[] = [];
  const checkedPaths = new Set<string>();

  for (const contract of REPO_SKILL_CONTRACTS) {
    let combined = "";

    for (const relativePath of contract.paths) {
      const absolutePath = resolve(root, relativePath);
      checkedPaths.add(absolutePath);
      try {
        const content = await readFile(absolutePath, "utf8");
        if (RAW_LLM_PATTERN.test(content)) {
          issues.push(`${contract.name}: raw LLM call pattern found in ${relativePath}`);
        }
        combined += `\n${content}`;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          issues.push(`${contract.name}: missing required repo path ${relativePath}`);
          continue;
        }
        throw error;
      }
    }

    for (const pattern of contract.requiredPatterns) {
      if (!pattern.test(combined)) {
        issues.push(`${contract.name}: missing required repo contract pattern ${pattern}`);
      }
    }
  }

  return {
    skill_usage_correct: issues.length === 0,
    issues,
    checked_paths: Array.from(checkedPaths).sort()
  };
}

export { REPO_SKILL_CONTRACTS };
