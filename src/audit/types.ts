export interface AuditInput {
  prompt: string;
  constraints?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuditOutput {
  claims: string[];
  evidence: string[];
  implications?: string[];
  [key: string]: unknown;
}

export interface AuditValidationResult {
  valid: boolean;
  failures: string[];
}

export interface AuditEvaluationResult {
  score: 1 | 2 | 3 | 4 | 5;
  failures: string[];
}

export interface AuditLogRecord {
  input: AuditInput;
  output: AuditOutput;
  score: number;
  failures: string[];
  iteration: number;
}

export interface AuditLoopResult {
  runId: string;
  iterations: number;
  finalInput: AuditInput;
  finalOutput: AuditOutput;
  validation: AuditValidationResult;
  evaluation: AuditEvaluationResult;
  logPath: string;
  observedPatterns: string[];
}

export interface PatternMemoryRecord {
  pattern: string;
  count: number;
}

export interface SkillsAuditResult {
  skills_valid: boolean;
  issues: string[];
  checked_skills?: string[];
}

export interface SrcAuditResult {
  loop_found: boolean;
  evaluation_called: boolean;
  memory_violation: boolean;
}

export interface SkillUsageAuditResult {
  skill_usage_correct: boolean;
  issues?: string[];
  checked_paths?: string[];
}

export interface LearningAuditResult {
  learning: boolean;
  issues: string[];
  checked_paths?: string[];
}

export interface FinalAuditOutput {
  loop: boolean;
  evaluation: boolean;
  learning: boolean;
  skills_valid: boolean;
  skill_usage_correct: boolean;
  memory_violation: boolean;
}
