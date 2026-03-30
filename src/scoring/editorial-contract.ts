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
}

export interface EditorialCompetitivenessAssessment {
  status: EditorialCompetitivenessStatus;
  reasons: string[];
  humanNewsHeadline: boolean;
  operatorConsequence: boolean;
  broadWinnerShape: boolean;
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

function hasRequiredUpgradeWindow(text: string): boolean {
  return /\brequired upgrade\b|\bgenesis sync\b|\bactivation\b|\bbitcoin block\b|\bupgrade before\b/i.test(text);
}

function hasOperatorConsequence(text: string): boolean {
  return /\bagents should\b|\boperators should\b|\bmatters because\b|\brequires\b|\bupgrade\b|\brisk\b|\bwindow\b|\bconsequence\b/i.test(text);
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

export function assessEditorialCompetitiveness(
  input: EditorialCandidateInput
): EditorialCompetitivenessAssessment {
  const contextText = buildContextText(input);
  const operatorConsequence = hasOperatorConsequence(contextText);
  const broadWinnerShape = hasBroadWinnerShape(input.headline, contextText);
  const rawReleaseNote = hasRawReleaseNoteShape(input.headline);
  const artifactTitle = hasArtifactTitleShape(input.headline);
  const genericExternalAdaptation = readsLikeGenericExternalAdaptation(input, contextText);
  const reasons: string[] = [];

  if (artifactTitle) {
    reasons.push("editorial contract failed: headline is artifact-led instead of human-news-led");
  }

  if (rawReleaseNote && !operatorConsequence) {
    reasons.push("editorial contract failed: raw release-note framing without operator consequence");
  }

  if (!operatorConsequence && !broadWinnerShape) {
    reasons.push("editorial contract failed: story lacks a clear operator or system consequence");
  }

  if (genericExternalAdaptation) {
    reasons.push("editorial contract failed: external story is still descriptive instead of operator-actionable");
  }

  return {
    status: reasons.length === 0 ? "competitive" : "valid_but_not_competitive",
    reasons,
    humanNewsHeadline: !artifactTitle && !rawReleaseNote,
    operatorConsequence,
    broadWinnerShape
  };
}
