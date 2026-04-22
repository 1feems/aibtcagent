import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { auditSkills, DEFAULT_SKILL_TARGETS } from "./skill-check.js";
import { auditSrc } from "./src-check.js";
import { auditSkillUsage } from "./skill-usage.js";
import { auditLearning } from "./learning-check.js";
import type { FinalAuditOutput } from "./types.js";

export async function runRepositoryAudit(root = process.cwd()): Promise<FinalAuditOutput & {
  skills: Awaited<ReturnType<typeof auditSkills>>;
  src: Awaited<ReturnType<typeof auditSrc>>;
  skillUsage: Awaited<ReturnType<typeof auditSkillUsage>>;
  learningAudit: Awaited<ReturnType<typeof auditLearning>>;
}> {
  const [skills, src, skillUsage, learningAudit] = await Promise.all([
    auditSkills(DEFAULT_SKILL_TARGETS),
    auditSrc(root),
    auditSkillUsage(root),
    auditLearning(root)
  ]);

  return {
    loop: src.loop_found,
    evaluation: src.evaluation_called,
    learning: learningAudit.learning,
    skills_valid: skills.skills_valid,
    skill_usage_correct: skillUsage.skill_usage_correct,
    memory_violation: src.memory_violation,
    skills,
    src,
    skillUsage,
    learningAudit
  };
}

async function main(): Promise<void> {
  const result = await runRepositoryAudit(process.cwd());
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
