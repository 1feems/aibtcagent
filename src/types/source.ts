export type SourceType =
  | "rpc"
  | "api"
  | "contract"
  | "explorer"
  | "documentation"
  | "inbox"
  | "brief"
  | "live-feed"
  | "other";

export type SourceRole = "primary-proof" | "verification" | "context" | "intel";

export interface SourceRecord {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  sourceRole: SourceRole;
}
