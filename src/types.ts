// ── Node execution status ───────────────────────────────────────────────

export type NodeStatus = "pending" | "running" | "completed" | "error" | "skipped";

export interface NodeState {
  name: string;
  status: NodeStatus;
  error: string | null;
}

export interface ProgressNode {
  name: string;
  status: NodeStatus;
  started_at: number | null;
  completed_at: number | null;
  error: string | null;
}

export interface AuditStatus {
  audit_id: string;
  status: "running" | "completed" | "error";
  created_at: number;
  completed_at: number | null;
  error: string | null;
  nodes: ProgressNode[];
}

// ── Graph topology for the frontend ────────────────────────────────────

export interface GraphEdge {
  from: string;
  to: string;
}

/** All 14 LangGraph nodes in display order */
export const ALL_NODES: string[] = [
  "orchestrator",
  "fan_out",
  "semgrep",
  "osv",
  "github",
  "scan_secrets_pii",
  "scan_repo_governance",
  "scan_sbom_license",
  "scan_iac_config",
  "scan_cicd_security",
  "scan_data_classification",
  "scanner_merge",
  "compliance_mapper",
  "report_generator",
];

/** Short display labels for each node */
export const NODE_LABELS: Record<string, string> = {
  orchestrator: "Orchestrator",
  fan_out: "Fan Out",
  semgrep: "Semgrep",
  osv: "OSV Scanner",
  github: "GitHub Checks",
  scan_secrets_pii: "Secrets & PII",
  scan_repo_governance: "Governance",
  scan_sbom_license: "SBOM & License",
  scan_iac_config: "IaC Config",
  scan_cicd_security: "CI/CD Security",
  scan_data_classification: "Data Classification",
  scanner_merge: "Scanner Merge",
  compliance_mapper: "Compliance Mapper",
  report_generator: "Report Generator",
};

/** Graph edges for the pipeline DAG — all 9 scanners run fully parallel */
export const GRAPH_EDGES: GraphEdge[] = [
  { from: "orchestrator", to: "fan_out" },
  // Fan-out: 9 parallel branches
  { from: "fan_out", to: "semgrep" },
  { from: "fan_out", to: "osv" },
  { from: "fan_out", to: "github" },
  { from: "fan_out", to: "scan_secrets_pii" },
  { from: "fan_out", to: "scan_repo_governance" },
  { from: "fan_out", to: "scan_sbom_license" },
  { from: "fan_out", to: "scan_iac_config" },
  { from: "fan_out", to: "scan_cicd_security" },
  { from: "fan_out", to: "scan_data_classification" },
  // All 9 converge to merge
  { from: "semgrep", to: "scanner_merge" },
  { from: "osv", to: "scanner_merge" },
  { from: "github", to: "scanner_merge" },
  { from: "scan_secrets_pii", to: "scanner_merge" },
  { from: "scan_repo_governance", to: "scanner_merge" },
  { from: "scan_sbom_license", to: "scanner_merge" },
  { from: "scan_iac_config", to: "scanner_merge" },
  { from: "scan_cicd_security", to: "scanner_merge" },
  { from: "scan_data_classification", to: "scanner_merge" },
  // Rest of pipeline
  { from: "scanner_merge", to: "compliance_mapper" },
  { from: "compliance_mapper", to: "report_generator" },
];

// ── Audit results ───────────────────────────────────────────────────────

export interface Finding {
  tool: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  file_path: string | null;
  rule_id: string | null;
  finding_type: string | null;
  remediation: string | null;
}

export interface MappedControl {
  finding: Finding;
  framework: string;
  control_id: string;
  control_name: string;
  explanation: string;
}

export interface FrameworkData {
  controls_triggered: number;
  findings: MappedControl[];
}

export interface AuditReport {
  repo_url: string;
  overall_score: number;
  executive_summary: string;
  frameworks: Record<string, FrameworkData>;
  framework_scores: Record<string, number>;
  severity_breakdown: Record<string, number>;
  error?: string | null;
}

// ── API responses ───────────────────────────────────────────────────────

export interface StartAuditResponse {
  audit_id: string;
  repo_url: string;
  graph_nodes: string[];
}

export interface UploadResponse {
  audit_id: string;
  repo_url: string;
  repo_name: string;
}

export interface StaticStatusResponse {
  status: "ready";
  graph_nodes: string[];
}

// ── Input types ─────────────────────────────────────────────────────────

export type InputType = "github" | "git" | "zip";
