import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface SignalTemplateConfig {
  _analysis_rules?: string[];
  _tags_rules?: string[];
  _disclosure_rules?: string[];
  _headline_rules?: string[];
}

let cachedTemplate: SignalTemplateConfig | null = null;

export function extractStoryAnchors(text: string): string[] {
  return [...new Set([
    ...text.matchAll(/\bissue\s+#\d+\b/gi),
    ...text.matchAll(/\bpr\s+#\d+\b/gi),
    ...text.matchAll(/\bcve-\d{4}-\d+\b/gi),
    ...text.matchAll(/\bv\d+\.\d+(?:\.\d+)*(?:\.\d+)?\b/gi),
    ...text.matchAll(/\barxiv:\d{4}\.\d{4,5}\b/gi)
  ].map((match) => match[0].toLowerCase()))];
}

export function extractMetricAnchors(text: string): string[] {
  return [...new Set([
    ...text.matchAll(/\$\d[\d,]*(?:\.\d+)?/g),
    ...text.matchAll(/\b\d+(?:\.\d+)?%/g),
    ...text.matchAll(/\b\d[\d,.]*\s*(?:hours?|days?|cycles?|agents?|signals?|slots?|blocks?|txs?)\b/gi),
    ...text.matchAll(/\b\d[\d,.]*[KMBk]?\s*sats?\b/gi),
    ...text.matchAll(/\b\d[\d,.]*(?:\.\d+)?\s*(?:bytes?|kb|mb|gb)\b/gi)
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

export function hasExactAnchor(text: string): boolean {
  return (
    extractStoryAnchors(text).length > 0 ||
    extractMetricAnchors(text).length > 0 ||
    /`[^`]+`/.test(text) ||
    /\b(?:err\s+[a-z0-9_]+|error\s+[a-z0-9_]+)\b/i.test(text) ||
    /\b(?:post|get|put|patch|delete)\s+\/[a-z0-9/_-]+\b/i.test(text) ||
    /\bhttp\s*(?:4\d\d|5\d\d)\b/i.test(text) ||
    /\bcvss\s*\d+(?:\.\d+)?\b/i.test(text) ||
    /\bblock(?:\s+height)?\s*\d{5,}\b/i.test(text)
  );
}

export function hasExactHeadlineAnchor(headline: string): boolean {
  return hasExactAnchor(headline);
}

export function hasFrameworkAAnalysis(text: string): boolean {
  const lower = text.toLowerCase();
  return /\bclaim\s*:/.test(lower) &&
    /\bevidence\s*:/.test(lower) &&
    /\bimplication\s*:/.test(lower);
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

// ── Documentation-signal detection ───────────────────────────────────────────
//
// A signal whose headline describes HOW the platform works (capability,
// process, requirement) rather than WHAT CHANGED is documentation, not news.
// These signals are hard-blocked from filing even when they pass other
// mechanical checks and carry a structurally valid anchor (e.g. an API path).
//
// The check is two-step:
//   1. Headline matches a documentation/instructional pattern.
//   2. Neither headline nor body contains a fresh-event proof.
//
// A signal that matches step 1 but also has a PR#, shipped version, HTTP
// incident, or sats metric is describing a CHANGE and is NOT blocked.

const DOCUMENTATION_HEADLINE_PATTERNS: readonly RegExp[] = [
  /\brequires?\s+(?:a\s+)?(?:bip-\d+|signature|signed\s+payload|authentication|auth)\b/i,
  /\bmust\s+include\b/i,
  /\baccepts?\s+(?:a\s+)?(?:bip-\d+|signed|payload|format)\b/i,
  /\buses?\s+(?:a\s+)?bip-\d+\b/i,
  /\bhow\s+(?:to|agents?|operators?)\s+(?:file|submit|call|post|sign)\b/i,
  /\b(?:agents?|operators?)\s+(?:should|must|can|need\s+to)\s+(?:use|include|sign|call|post|add|attach)\b/i,
  /\bto\s+file\s+(?:a\s+)?signal\b/i,
  /\bwhen\s+filing\b/i,
  /\bsignal\s+(?:format|schema|template|structure|payload)\b/i,
];

const FRESH_EVENT_MARKERS: readonly RegExp[] = [
  /\b(?:merged|shipped|deployed|released|launched|activated|enforced|enabled|updated|patched)\b/i,
  /\bnow\s+(?:live|active|enabled|enforced|required|deployed)\b/i,
  /\bgoes?\s+live\b/i,
  /\bpr\s*#\d+\b/i,
  /\bissue\s*#\d+\b/i,
  /\bv\d+\.\d+(?:\.\d+)?\b/,
  /\bhttp\s*(?:4\d\d|5\d\d)\b/i,
  /\bcve-\d{4}-\d+\b/i,
  /\bblock(?:\s+height)?\s*[\d,]{5,}\b/i,
  /\b\d[\d,.]*[KMBk]?\s*sats?\b/i,
];

/**
 * Returns true when the headline matches a documentation or instructional
 * pattern (describing how the platform works) AND neither the headline nor
 * the body contains a fresh-event proof.
 *
 * Callers should throw with "Verdict: hold / not filing_ready" when this
 * returns true — no helper-ready JSON should be produced.
 */
export function isDocumentationSignal(headline: string, body: string): boolean {
  if (!DOCUMENTATION_HEADLINE_PATTERNS.some((p) => p.test(headline))) return false;
  const combined = `${headline}\n${body}`;
  return !FRESH_EVENT_MARKERS.some((p) => p.test(combined));
}
