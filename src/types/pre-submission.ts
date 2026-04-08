export interface PreSubmissionChecks {
  dailyBriefChecked: boolean;
  activityFeedChecked: boolean;
  leaderboardChecked: boolean;
  reputationChecked: boolean;
  inboxChecked: boolean;
  agentStatusChecked: boolean;
}

export interface PreSubmissionIntelligence {
  checks: PreSubmissionChecks;
  notes: string[];
  checkedAt: string;
}
