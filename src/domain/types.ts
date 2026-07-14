export type RuleStatus = "pass" | "fail" | "warn" | "skip" | "error";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Confidence = "high" | "medium" | "low";

export type Category =
  | "verification"
  | "environment"
  | "safety"
  | "context"
  | "integrity";

export interface Evidence {
  kind: "file" | "manifest" | "script" | "workflow" | "derived";
  path?: string;
  line?: number;
  message: string;
}

export interface Finding {
  ruleId: string;
  category: Category;
  status: RuleStatus;
  severity: Severity;
  confidence: Confidence;
  title: string;
  impact: string;
  recommendation?: string;
  evidence: Evidence[];
  earnedPoints: number;
  maxPoints: number;
}

export interface RepositoryIdentity {
  name: string;
  root: string;
  gitRepository: boolean;
}

export interface RepositoryProfile {
  ecosystems: string[];
  fileCount: number;
  totalBytes: number;
}

export interface CategoryScore {
  category: Category;
  weight: number;
  score: number | null;
  earnedPoints: number;
  maxPoints: number;
}

export interface ScoreSummary {
  overall: number | null;
  categories: CategoryScore[];
}

export interface AnalysisLimitation {
  code: string;
  message: string;
  path?: string;
  affectsCompleteness: boolean;
}

export interface ScanResult {
  schemaVersion: "1";
  toolVersion: string;
  complete: boolean;
  repository: RepositoryIdentity;
  profile: RepositoryProfile;
  findings: Finding[];
  scores: ScoreSummary;
  limitations: AnalysisLimitation[];
  durationMs: number;
}

export interface RepositoryFile {
  path: string;
  size: number;
  contentReadable: boolean;
}

export interface RepositorySnapshot {
  root: string;
  files: RepositoryFile[];
  totalBytes: number;
  limitations: AnalysisLimitation[];
}
