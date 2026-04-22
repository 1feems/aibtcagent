import { hasExactAnchor } from "../filing/template-rules.js";

export interface WinnerGateSource {
  url?: string;
  title?: string;
}

export interface WinnerGateInput {
  headline: string;
  body: string;
  disclosure?: string | null;
  sources?: WinnerGateSource[];
}

export interface WinnerGateResult {
  passed: boolean;
  reasons: string[];
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAnchorInHeadline(headline: string): boolean {
  return hasExactAnchor(headline);
}

function hasClaimEvidenceImplication(body: string): boolean {
  const sentences = body.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (sentences.length < 2) return false;
  // Evidence: at least one sentence must contain a structured anchor (PR, issue, API, version, block, sats)
  const hasEvidenceSentence = sentences.some((s) =>
    /\bissue\s+#\d+|\bpr\s+#\d+|\brelease\b|\bv\d+\.\d+|\bapi\b|\bblock\s*\d{5,}|\b\d[\d,.]*[KMBk]?\s*sats?/i.test(s)
  );
  // Implication: at least one sentence must contain a direct agent/operator action
  const hasImplicationSentence = sentences.some((s) =>
    /\bagents should\b|\boperators should\b|\boperators need\b|\bcorrespondents should\b|\bthis means\b|\bwhich means\b|\bas a result\b|\bso that\b/i.test(s)
  );
  return hasEvidenceSentence && hasImplicationSentence;
}

function hasOperatorActionability(text: string): boolean {
  return (
    /\bagents should\b|\boperators should\b|\bpublishers can\b|\bcorrespondents can\b/i.test(text) ||
    /\bchanges\b|\bforces\b|\brequires\b|\blets\b|\bgives\b|\bturns\b|\bdelays\b|\benables\b|\bblocks\b|\brestores\b|\bprevents\b/i.test(text)
  );
}

function hasDurableEconomicOrSystemConsequence(text: string): boolean {
  return (
    /\bscore\b|\bleaderboard\b|\bbrief[- ]inclusion\b|\bpayout\b|\bearnings\b|\bsettlement\b|\bpayment\b|\binbox\b|\bidentity\b|\battribution\b|\brouting\b|\bsubmission\b|\bdispatch\b|\breview\b|\bworkflow\b|\bqueue\b|\bonboarding\b|\bregistration\b|\bblock production\b|\bchainstate\b/i.test(text)
  );
}

function isVisibilityOnlyWorkflowStory(text: string): boolean {
  const normalized = normalizeText(text);
  const visibilityTerms =
    /\bshows\b|\bdisplay(?:s)?\b|\bpage\b|\/signals\b|\bui\b|\bsidebar\b|\bcard\b|\bmobile\b|\bheadline size\b|\bresponsive\b|\blayout\b/i.test(normalized);
  const durableTerms =
    /\bscore\b|\bleaderboard\b|\bpayout\b|\bearnings\b|\bsettlement\b|\bpayment\b|\binbox\b|\bidentity\b|\battribution\b|\brouting\b|\bqueue\b|\bdispatch\b|\breview\b/i.test(normalized);
  return visibilityTerms && !durableTerms;
}

function readsLikeRawChangelog(headline: string, body: string): boolean {
  const combined = `${headline} ${body}`;
  return (
    /\badds?\b.*\band\b.*\badds?\b/i.test(headline) ||
    /\bsubmitted to\b/i.test(body) ||
    /\bnot just that prs exist\b/i.test(body) ||
    (!/\bmatters\b|\bmeans\b|\bchanges\b|\bturns\b|\bgives\b|\blets\b|\bforces\b/i.test(combined) &&
      /\bpr\s+#\d+\b|\brelease\b|\bv\d+\.\d+/i.test(combined))
  );
}

function hasConcreteDisclosure(disclosure: string, sources: WinnerGateSource[]): boolean {
  if (disclosure.trim().length === 0) {
    return false;
  }

  const hasToolOrMethod =
    /\b(?:claude|gpt|grok|gemini|opus|sonnet|haiku|curl|rg|npm|node|bun|gh|github|release notes|issue review|api|endpoint|search)\b/i.test(disclosure);
  const hasSourceAnchor =
    sources.some((source) => typeof source.url === "string" && source.url.trim().length > 0) ||
    /https?:\/\//i.test(disclosure) ||
    /\bissue\s+#\d+\b|\bpr\s+#\d+\b|\brelease\b/i.test(disclosure);

  return hasToolOrMethod && hasSourceAnchor;
}

export function evaluateWinnerGate(input: WinnerGateInput): WinnerGateResult {
  const headline = input.headline.trim();
  const body = input.body.trim();
  const disclosure = input.disclosure?.trim() ?? "";
  const sources = input.sources ?? [];
  const combined = `${headline} ${body}`;
  const reasons: string[] = [];

  if (!hasAnchorInHeadline(headline)) {
    reasons.push("anchor (PR/issue/CVE/version/exact metric/sats amount) must appear in the headline — winners always lead with the hard fact");
  }
  if (!hasExactAnchor(combined)) {
    reasons.push("missing exact anchor such as an issue/PR/CVE/version or hard metric anywhere in headline or body");
  }
  if (!hasClaimEvidenceImplication(body)) {
    reasons.push("body missing CLAIM → EVIDENCE → IMPLICATION structure: needs at least one evidence sentence (PR/issue/API/block/sats) and one 'agents should' / 'this means' implication sentence");
  }
  if (!hasOperatorActionability(combined)) {
    reasons.push("missing a direct operator or correspondent action/consequence");
  }
  if (!hasDurableEconomicOrSystemConsequence(combined)) {
    reasons.push("missing a durable economic, scoring, routing, identity, or system consequence");
  }
  if (isVisibilityOnlyWorkflowStory(combined)) {
    reasons.push("reads like a visibility/UI workflow improvement instead of a durable network signal");
  }
  if (readsLikeRawChangelog(headline, body)) {
    reasons.push("reads like a changelog notification rather than a winner-tier signal");
  }
  if (!hasConcreteDisclosure(disclosure, sources)) {
    reasons.push("disclosure is not concrete enough to reproduce the signal");
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
}
