// ── Editor types (P21) ────────────────────────────────────────────────────────

export interface SubmittedSignal {
  id: string;
  beat: string;
  beat_slug?: string;
  status: string;
  headline: string;
  analysis: string;
  sources: Array<{ url: string; title?: string }>;
  correspondent: string;
  submitted_at: string;
  created_at?: string;
}

export interface ScoreBreakdown {
  verification: number;      // 0–40
  operationalImpact: number; // 0–30
  sourceQuality: number;     // 0–20
  clarityActionability: number; // 0–10
}

export type BeatRelevance = "core" | "tangential" | "off-beat";
export type Recommendation = "approve" | "revise" | "reject";
export type Confidence = "low" | "medium" | "high";
export type SpotCheckResult = "pass" | "fail" | "pending";

export interface EditorAnnotation {
  signal_id: string;
  correspondent: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  factcheck: {
    verified: string[];
    flagged: string[];
    sources_checked: string[];
  };
  edit_suggestions: string | null;
  beat_relevance: BeatRelevance;
  recommendation: Recommendation;
  confidence: Confidence;
  feedback_for_correspondent: string | null;
  annotatedAt: string;
}

export interface EditorMemoryEntry {
  signal_id: string;
  headline: string;
  correspondent: string;
  score: number;
  recommendation: Recommendation;
  confidence: Confidence;
  submitted_at: string;
  spot_check_result: SpotCheckResult;
  beat_relevance: BeatRelevance;
}

export interface CorrespondentPattern {
  address: string;
  reviewCount: number;
  errorTypes: string[];
}

export interface EditorMemory {
  reviewed: EditorMemoryEntry[];
  stats: {
    total: number;
    approve: number;
    revise: number;
    reject: number;
    spotCheckPass: number;
    spotCheckFail: number;
    spotCheckPending: number;
  };
  correspondentPatterns: Record<string, CorrespondentPattern>;
  beatLessons: Record<string, Array<{ date: string; lesson: string; source: string }>>;
  lastUpdated: string;
}
