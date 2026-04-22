export type EditorialCompetitivenessStatus =
  | "competitive"
  | "valid_but_not_competitive";

interface EditorialCandidateInput {
  headline: string;
  summary?: string;
  significance?: string;
  causality?: string;
  proofNotes?: string[];
  sourceTypes?: string[];
  sourceUrls?: string[];
}

export interface EditorialCompetitivenessAssessment {
  status: EditorialCompetitivenessStatus;
  reasons: string[];
  humanNewsHeadline: boolean;
  operatorConsequence: boolean;
  broadWinnerShape: boolean;
  exactAnchor: boolean;
  storyOfValue: boolean;
}

function buildContextText(input: EditorialCandidateInput): string {
  return [
    input.headline,
    input.summary,
    input.significance,
    input.causality,
    ...(input.proofNotes ?? [])
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
}

function hasRawReleaseNoteShape(headline: string): boolean {
  return (
    /\bbug fixes?\b/i.test(headline) ||
    /\bcloses?\s+#\d+\b/i.test(headline) ||
    /\bv\d+\.\d+\.\d+\b/i.test(headline)
  );
}

function hasArtifactTitleShape(headline: string): boolean {
  const normalized = headline.trim().toLowerCase();
  return (
    /^\S+\s+ships\s+\S*?v\d+\.\d+/i.test(normalized) ||
    /^\S+:\s+/i.test(normalized) ||
    /\(#\d+\)/.test(headline) ||
    /\([0-9a-f]{7,}\)/i.test(headline)
  );
}

function hasStructuralPattern(text: string): boolean {
  return /\bcluster|gap|bottleneck|threshold|saturation|queue|concentration|backlog|lead|dominat/i.test(text);
}

function hasExactAnchor(text: string): boolean {
  return /\b\d[\d,.]*(?:\s?(?:k|m|b|sats?|sat|stx|btc|%))?\b/i.test(text) ||
    /\bv\d+\.\d+(?:\.\d+)?\b/i.test(text) ||
    /\bpr\s*#?\d+\b/i.test(text);
}

function hasRequiredUpgradeWindow(text: string): boolean {
  return /\brequired upgrade\b|\bgenesis sync\b|\bactivation\b|\bbitcoin block\b|\bupgrade before\b/i.test(text);
}

function hasOperatorConsequence(text: string): boolean {
  return /\bagents should\b|\boperators should\b|\boperators may need\b|\bmatters because\b|\brequires\b|\bneed to review\b|\breview before\b|\bupgrade\b|\brisk\b|\bwindow\b|\bconsequence\b|\breduces?\b|\bprevents?\b|\bkeeps?\b|\bclears?\b|\bstops?\b|\brestores?\b|\bavoids?\b/i.test(text);
}

function hasBroadWinnerShape(headline: string, text: string): boolean {
  const numericAnchors = headline.match(/\b\d[\d,.]*\b/g) ?? [];
  return (
    /\b(and|plus|simultaneous|bundle|bundled|combined|cluster)\b/i.test(headline) ||
    /\bbroader\b|\bstructural\b|\bsystem\b|\bnetwork-level\b|\bnetwork wide\b/i.test(text) ||
    numericAnchors.length >= 2
  );
}

function readsLikeGenericExternalAdaptation(input: EditorialCandidateInput, contextText: string): boolean {
  const sourceTypes = [...new Set((input.sourceTypes ?? []).filter(Boolean))];
  return (
    sourceTypes.length > 0 &&
    sourceTypes.every((value) => value === "live-feed") &&
    /published this event/i.test(input.causality ?? "") &&
    !hasStructuralPattern(contextText) &&
    !hasRequiredUpgradeWindow(contextText)
  );
}

function isAibtcNativeSource(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname === "github.com") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments[0] === "aibtcdev";
    }

    return parsed.hostname === "aibtc.news" || parsed.hostname === "aibtc.com";
  } catch {
    return false;
  }
}

function isAibtcNativeOperatorStory(input: EditorialCandidateInput, contextText: string): boolean {
  const sourceUrls = input.sourceUrls ?? [];
  return sourceUrls.some(isAibtcNativeSource) && hasOperatorConsequence(contextText);
}

function hasConcreteNetworkAnchor(text: string): boolean {
  return /\b(aibtc|agent-news|landing-page|mcp-server|x402|sbtc|beat|brief|correspondent|genesis|leaderboard|heartbeat|inbox|service registry|relay)\b/i.test(text);
}

function isExternalWithoutAibtcNetworkActivity(
  input: EditorialCandidateInput,
  contextText: string
): boolean {
  const sourceUrls = input.sourceUrls ?? [];
  return sourceUrls.length > 0 && !sourceUrls.some(isAibtcNativeSource) && !hasConcreteNetworkAnchor(contextText);
}

function isRawDataWithoutThesis(
  input: EditorialCandidateInput,
  contextText: string,
  operatorConsequence: boolean,
  structuralPattern: boolean
): boolean {
  const baselineShape = /\b(baseline|snapshot|submitted|approved|rejected|unknown|moved from|page \d+ of \d+|delta|membership)\b/i;
  const countAnchor = /\b\d[\d,.]*\b/.test(contextText);
  return baselineShape.test(`${input.headline} ${contextText}`) && countAnchor && !operatorConsequence && !structuralPattern;
}

function isGenericOperationalAdvice(
  input: EditorialCandidateInput,
  contextText: string,
  exactAnchor: boolean,
  structuralPattern: boolean
): boolean {
  const colonLedSpeaker = /^[A-Z][a-z]+(?: [A-Z][a-z]+)*:/.test(input.headline);
  const adviceShape = /\b(process-control|deterministic claim templates?|verification gates?|preflight|sequencing|payload structure|first-pass progression|false-ready states|multi-wallet publishing loops|one-x-account-per-agent|activity logs)\b/i;
  return (colonLedSpeaker || adviceShape.test(contextText)) && !exactAnchor && !structuralPattern;
}

function hasHumanReadableNewsShape(headline: string): boolean {
  const wordCount = headline.trim().split(/\s+/).filter(Boolean).length;
  const separatorCount = (headline.match(/[;:]/g) ?? []).length;
  return wordCount <= 25 && separatorCount <= 2;
}

export function assessEditorialCompetitiveness(
  input: EditorialCandidateInput
): EditorialCompetitivenessAssessment {
  const contextText = buildContextText(input);
  const operatorConsequence = hasOperatorConsequence(contextText);
  const broadWinnerShape = hasBroadWinnerShape(input.headline, contextText);
  const structuralPattern = hasStructuralPattern(contextText);
  const exactAnchor = hasExactAnchor(input.headline) || hasExactAnchor(contextText);
  const requiredUpgradeWindow = hasRequiredUpgradeWindow(contextText);
  const rawReleaseNote = hasRawReleaseNoteShape(input.headline);
  const artifactTitle = hasArtifactTitleShape(input.headline);
  const genericExternalAdaptation = readsLikeGenericExternalAdaptation(input, contextText);
  const nativeOperatorStory = isAibtcNativeOperatorStory(input, contextText);
  const humanReadableNewsShape = hasHumanReadableNewsShape(input.headline);
  const storyOfValue = operatorConsequence || structuralPattern || requiredUpgradeWindow;
  const externalWithoutAibtcActivity = isExternalWithoutAibtcNetworkActivity(input, contextText);
  const rawDataWithoutThesis = isRawDataWithoutThesis(
    input,
    contextText,
    operatorConsequence,
    structuralPattern
  );
  const genericOperationalAdvice = isGenericOperationalAdvice(
    input,
    contextText,
    exactAnchor,
    structuralPattern
  );
  const reasons: string[] = [];

  if (artifactTitle && !nativeOperatorStory) {
    reasons.push("editorial contract failed: headline is artifact-led instead of human-news-led");
  }

  if (rawReleaseNote && !operatorConsequence && !nativeOperatorStory) {
    reasons.push("editorial contract failed: raw release-note framing without operator consequence");
  }

  if (!operatorConsequence && !broadWinnerShape) {
    reasons.push("editorial contract failed: story lacks a clear operator or system consequence");
  }

  if (!exactAnchor) {
    reasons.push("editorial contract failed: story lacks an exact anchor like a version, PR, count, threshold, block, or dollar figure");
  }

  if (!storyOfValue) {
    reasons.push("editorial contract failed: candidate describes a change but not a valuable story with operator or structural consequence");
  }

  if (!humanReadableNewsShape && !nativeOperatorStory) {
    reasons.push("editorial contract failed: headline is too dense to read like a brief-worthy human news story");
  }

  if (genericExternalAdaptation) {
    reasons.push("editorial contract failed: external story is still descriptive instead of operator-actionable");
  }

  if (externalWithoutAibtcActivity) {
    reasons.push("editorial contract failed: story does not show direct AIBTC network activity");
  }

  if (rawDataWithoutThesis) {
    reasons.push("editorial contract failed: raw counts need a decision-grade thesis, not just a baseline recap");
  }

  if (genericOperationalAdvice) {
    reasons.push("editorial contract failed: generic operational advice is not a concrete intelligence signal");
  }

  return {
    status: reasons.length === 0 ? "competitive" : "valid_but_not_competitive",
    reasons,
    humanNewsHeadline: nativeOperatorStory || (!artifactTitle && !rawReleaseNote),
    operatorConsequence,
    broadWinnerShape,
    exactAnchor,
    storyOfValue
  };
}
