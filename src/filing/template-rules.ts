import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface SignalTemplateConfig {
  _analysis_rules?: string[];
  _tags_rules?: string[];
  _disclosure_rules?: string[];
  _headline_rules?: string[];
}

let cachedTemplate: SignalTemplateConfig | null = null;

function extractStoryAnchors(text: string): string[] {
  return [...new Set([
    ...text.matchAll(/\bissue\s+#\d+\b/gi),
    ...text.matchAll(/\bpr\s+#\d+\b/gi),
    ...text.matchAll(/\bcve-\d{4}-\d+\b/gi),
    ...text.matchAll(/\bv\d+\.\d+(?:\.\d+)*(?:\.\d+)?\b/gi)
  ].map((match) => match[0].toLowerCase()))];
}

function extractMetricAnchors(text: string): string[] {
  return [...new Set([
    ...text.matchAll(/\$\d[\d,]*(?:\.\d+)?/g),
    ...text.matchAll(/\b\d+(?:\.\d+)?%/g),
    ...text.matchAll(/\b\d+\s*(?:hours?|days?|cycles?|agents?|signals?|slots?)\b/gi),
    ...text.matchAll(/\b\d{2,}\s*sats?\b/gi)
  ].map((match) => match[0].toLowerCase()))];
}

export async function loadSignalTemplate(baseDir?: string): Promise<SignalTemplateConfig> {
  if (cachedTemplate) return cachedTemplate;
  const path = resolve(baseDir ?? process.cwd(), "data/config/signal-template.json");
  const raw = await readFile(path, "utf8");
  cachedTemplate = JSON.parse(raw) as SignalTemplateConfig;
  return cachedTemplate;
}

export function resetSignalTemplateCache(): void {
  cachedTemplate = null;
}

export function hasExactHeadlineAnchor(headline: string): boolean {
  return (
    extractStoryAnchors(headline).length > 0 ||
    extractMetricAnchors(headline).length > 0 ||
    /`[^`]+`/.test(headline) ||
    /\b(?:err\s+[a-z0-9_]+|error\s+[a-z0-9_]+)\b/i.test(headline) ||
    /\b(?:post|get|put|patch|delete)\s+\/[a-z0-9/_-]+\b/i.test(headline)
  );
}

export function hasFrameworkAAnalysis(text: string): boolean {
  const lower = text.toLowerCase();
  return /\bclaim\s*:/.test(lower) &&
    /\bevidence\s*:/.test(lower) &&
    /\bimplication\s*:/.test(lower) &&
    /\bdirective\s*:/.test(lower);
}

export function hasFrameworkBAnalysis(text: string): boolean {
  const lower = text.toLowerCase();
  return /\bwhat changed\s*:/.test(lower) &&
    /\bwhat it means\s*:/.test(lower) &&
    /\bwhat to do\s*:/.test(lower);
}

export function hasTemplateAnalysis(text: string): boolean {
  return hasFrameworkAAnalysis(text) || hasFrameworkBAnalysis(text);
}

export function hasTerminalDirective(text: string): boolean {
  return /\b(?:directive|what to do)\s*:.*\b(update|verify|pause|audit|redeploy|avoid|monitor|report|migrate|check)\b/i.test(text);
}

export function hasVagueDisclosure(disclosure: string): boolean {
  const lower = disclosure.toLowerCase();
  return ["used ai", "my own analysis", "various sources", "internal data", "used llm", "ai generated", "model output", "my analysis"]
    .some((pattern) => lower.includes(pattern));
}

export function hasConcreteDisclosureAnchors(disclosure: string): boolean {
  if (disclosure.trim().length < 24) return false;
  return (
    /\b(?:claude|gpt|grok|gemini|opus|sonnet|haiku)\b/i.test(disclosure) ||
    /\b(?:curl|rg|npm|node|bun|gh|api|endpoint|query|search)\b/i.test(disclosure) ||
    /\/api\/|https?:\/\/|github\.com|issue\s+#\d+|pr\s+#\d+|release/i.test(disclosure)
  );
}

export function tooManyTags(tags: string[]): boolean {
  return tags.length > 2;
}
