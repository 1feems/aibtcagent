import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { auditSkills, auditSourceFile, updatePatternMemory } from "../dist/audit/index.js";

test("auditSkills validates simple skill schema and catches missing metadata", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-audit-skills-"));
  try {
    await mkdir(resolve(tempDir, "skills/good-skill"), { recursive: true });
    const goodPath = resolve(tempDir, "skills/good-skill/SKILL.md");
    await writeFile(
      goodPath,
      [
        "---",
        'name: "good-skill"',
        'description: "Does one thing well"',
        "metadata:",
        '  author: "OpenAI"',
        "---",
        "",
        "## Goal",
        "Use this skill to do one job.",
        "",
        "## Output Contract",
        "Return one result.",
        "",
        "## Analysis Workflow",
        "Follow the loop exactly.",
        "",
        "Examples:",
        "- \"do one job\"",
        "",
        "Do not use it for other jobs.",
        "what to stop doing",
        "what to keep doing",
        "what to change in `create-signal`"
      ].join("\n"),
      "utf8"
    );
    const good = await auditSkills([
      {
        name: "good-skill",
        path: goodPath,
        requiredPhrases: ["## Goal", "## Output Contract", "## Analysis Workflow", "Do not use it for other jobs."],
        preferredPhrases: ["what to stop doing", "what to keep doing", "what to change in `create-signal`"]
      }
    ]);
    assert.equal(good.skills_valid, true);

    await mkdir(resolve(tempDir, "skills/bad-skill"), { recursive: true });
    const badPath = resolve(tempDir, "skills/bad-skill/SKILL.md");
    await writeFile(badPath, "## Goal\nMissing frontmatter\n", "utf8");
    const bad = await auditSkills([
      {
        name: "bad-skill",
        path: badPath,
        requiredPhrases: ["## Goal", "## Output Contract"],
        preferredPhrases: ["schema"]
      }
    ]);
    assert.equal(bad.skills_valid, false);
    assert.equal(bad.issues.some((issue) => issue.includes("bad-skill: missing frontmatter name")), true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("auditSourceFile confirms loop + evaluator/validator calls and no memory writes", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-audit-src-"));
  const filePath = resolve(tempDir, "loop.ts");
  try {
    await writeFile(
      filePath,
      [
        "function x() {",
        "  while (true) {",
        "    validateAuditOutput({ claims: [], evidence: [] });",
        "    evaluateAuditOutput({ prompt: 'x' }, { claims: ['a'], evidence: ['b'] });",
        "    break;",
        "  }",
        "}"
      ].join("\n"),
      "utf8"
    );
    const result = await auditSourceFile(filePath);
    assert.deepEqual(result, {
      loop_found: true,
      evaluation_called: true,
      memory_violation: false
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("updatePatternMemory stores only pattern counts", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-audit-memory-"));
  const filePath = resolve(tempDir, "patterns.json");
  try {
    const result = await updatePatternMemory(filePath, ["missing_evidence", "missing_evidence", "constraint_violation"]);
    assert.deepEqual(result, [
      { pattern: "missing evidence -> fail", count: 2 },
      { pattern: "constraint violation -> fail", count: 1 }
    ]);
    const stored = JSON.parse(await readFile(filePath, "utf8"));
    assert.deepEqual(stored, result);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
