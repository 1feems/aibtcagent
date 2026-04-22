import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import type { SkillsAuditResult } from "./types.js";

interface SkillAuditTarget {
  name: string;
  path: string;
  requiredPhrases: string[];
  preferredPhrases: string[];
}

const DEFAULT_SKILL_TARGETS: SkillAuditTarget[] = [
  {
    name: "create-signal",
    path: "/Users/feems/Desktop/aibtcagent-workspace/duplicateaibtcagent2/skills/create-signal/SKILL.md",
    requiredPhrases: ["## Goal", "## Output Contract", "## Create-Signal Loop", "Do not use it for recording outcomes"],
    preferredPhrases: ["CLAIM", "EVIDENCE", "IMPLICATION", "verdict"]
  },
  {
    name: "record-signal-outcome",
    path: "/Users/feems/Desktop/aibtcagent-workspace/duplicateaibtcagent2/skills/record-signal-outcome/SKILL.md",
    requiredPhrases: ["## Goal", "## Output Contract", "## Step 3", "Do not use it to draft new signals"],
    preferredPhrases: ["daily-learn", "learnings.md", "filed-signals.json"]
  },
  {
    name: "analyze-signal-outcomes",
    path: "/Users/feems/Desktop/aibtcagent-workspace/duplicateaibtcagent2/skills/analyze-signal-outcomes/SKILL.md",
    requiredPhrases: ["## Goal", "## Output Contract", "## Analysis Workflow", "Do not use it for drafting a single signal"],
    preferredPhrases: ["what to stop doing", "what to keep doing", "what to change in `create-signal`"]
  }
];

function hasFrontmatterField(content: string, field: string): boolean {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return false;
  return new RegExp(`^${field}:`, "m").test(match[1]);
}

function normalize(content: string): string {
  return content.toLowerCase();
}

function assertSingleResponsibility(content: string, target: SkillAuditTarget): string[] {
  const issues: string[] = [];
  const lowered = normalize(content);
  const disallowedMentions = (lowered.match(/do not use it/gi) ?? []).length;
  if (disallowedMentions === 0) {
    issues.push(`${target.name}: missing explicit scope boundary`);
  }
  const examples = (content.match(/^Examples:/m) ? 1 : 0) + Array.from(content.matchAll(/^- "/gm)).length;
  if (examples === 0) {
    issues.push(`${target.name}: missing concrete examples for its single responsibility`);
  }
  return issues;
}

async function auditSkillTarget(target: SkillAuditTarget): Promise<string[]> {
  const issues: string[] = [];
  let content: string;

  try {
    content = await readFile(target.path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [`${target.name}: missing SKILL.md at ${target.path}`];
    }
    throw error;
  }

  if (!hasFrontmatterField(content, "name")) {
    issues.push(`${target.name}: missing frontmatter name`);
  }
  if (!hasFrontmatterField(content, "description")) {
    issues.push(`${target.name}: missing frontmatter description`);
  }
  if (!hasFrontmatterField(content, "metadata")) {
    issues.push(`${target.name}: missing frontmatter metadata block`);
  }

  for (const phrase of target.requiredPhrases) {
    if (!content.includes(phrase)) {
      issues.push(`${target.name}: missing required section or phrase '${phrase}'`);
    }
  }

  if (!target.preferredPhrases.some((phrase) => content.includes(phrase))) {
    issues.push(`${target.name}: missing role-specific schema details`);
  }

  issues.push(...assertSingleResponsibility(content, target));

  const skillDir = dirname(target.path);
  const expectedEntryDir = basename(skillDir);
  if (expectedEntryDir !== target.name) {
    issues.push(`${target.name}: path mismatch, expected directory '${target.name}'`);
  }

  return issues;
}

export async function auditSkills(targets: SkillAuditTarget[] = DEFAULT_SKILL_TARGETS): Promise<SkillsAuditResult> {
  const results = await Promise.all(targets.map((target) => auditSkillTarget(target)));
  const issues = results.flat();
  return {
    skills_valid: issues.length === 0,
    issues,
    checked_skills: targets.map((target) => target.path)
  };
}

export { DEFAULT_SKILL_TARGETS };
