import { createAuditRunId, writeAuditLog } from "./logger.js";
import type { AuditInput, AuditLoopResult, AuditOutput } from "./types.js";
import { evaluateAuditOutput } from "./evaluator.js";
import { validateAuditOutput } from "./validator.js";

interface AuditLoopOptions {
  root?: string;
  runId?: string;
  maxIterations?: number;
  tightenPrompt?: (input: AuditInput, failures: string[]) => AuditInput;
}

export async function runAuditedLoop(
  input: AuditInput,
  runAgent: (currentInput: AuditInput) => Promise<AuditOutput> | AuditOutput,
  options: AuditLoopOptions = {}
): Promise<AuditLoopResult> {
  let currentInput = input;
  let iteration = 0;
  const maxIterations = Math.max(1, options.maxIterations ?? 3);
  const runId = options.runId ?? createAuditRunId();
  const observedPatterns: string[] = [];

  while (true) {
    iteration += 1;
    const output = await runAgent(currentInput);
    const validation = validateAuditOutput(output);
    const evaluation = evaluateAuditOutput(currentInput, output);
    const failures = Array.from(new Set([...validation.failures, ...evaluation.failures]));
    observedPatterns.push(...failures);

    const logPath = await writeAuditLog(
      runId,
      {
        input: currentInput,
        output,
        score: evaluation.score,
        failures,
        iteration
      },
      options.root
    );

    if (evaluation.score >= 4) {
      return {
        runId,
        iterations: iteration,
        finalInput: currentInput,
        finalOutput: output,
        validation,
        evaluation,
        logPath,
        observedPatterns: Array.from(new Set(observedPatterns))
      };
    }

    if (failures.includes("missing_evidence") && iteration < maxIterations) {
      currentInput = options.tightenPrompt
        ? options.tightenPrompt(currentInput, failures)
        : {
            ...currentInput,
            prompt: `${currentInput.prompt}\nInclude direct evidence with exact source anchors.`
          };
      continue;
    }

    return {
      runId,
      iterations: iteration,
      finalInput: currentInput,
      finalOutput: output,
      validation,
      evaluation,
      logPath,
      observedPatterns: Array.from(new Set(observedPatterns))
    };
  }
}
