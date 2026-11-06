export type Severity = "info" | "low" | "medium" | "high";
export type Kind = "pr-body" | "commit" | "comment";

export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  evidence?: string;
}

export interface Report {
  tool: string;
  version: string;
  kind: Kind;
  target: string;
  verdict: string; // PASS | FAIL
  counts: Record<string, number>;
  findings: Finding[];
  summary: string;
}
