import React, { useMemo, useState } from "react";
import type { AuditReport, Finding, MappedControl } from "../types";

interface Props {
  report: AuditReport;
}

/** Merged finding with both SOC2 and ISO control info */
interface MergedFinding {
  finding: Finding;
  soc2_control: { control_id: string; control_name: string } | null;
  iso_control: { control_id: string; control_name: string } | null;
  frameworks: string[];
}

function findingKey(f: Finding): string {
  return `${f.tool}|${f.rule_id ?? f.title}|${f.description}`;
}

const SEV_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export default function FindingsTable({ report }: Props) {
  const [framework, setFramework] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Merge SOC2 and ISO controls per finding identity
  const merged = useMemo(() => {
    const map = new Map<string, MergedFinding>();
    for (const [fw, data] of Object.entries(report.frameworks)) {
      for (const mc of data.findings) {
        const key = findingKey(mc.finding);
        let entry = map.get(key);
        if (!entry) {
          entry = {
            finding: mc.finding,
            soc2_control: null,
            iso_control: null,
            frameworks: [],
          };
          map.set(key, entry);
        }
        entry.frameworks.push(fw);
        if (fw === "soc2") {
          entry.soc2_control = { control_id: mc.control_id, control_name: mc.control_name };
        } else if (fw === "iso27001") {
          entry.iso_control = { control_id: mc.control_id, control_name: mc.control_name };
        }
      }
    }
    return Array.from(map.values());
  }, [report]);

  let filtered = merged;
  if (framework !== "all") {
    filtered = filtered.filter((m) => m.frameworks.includes(framework));
  }
  if (severityFilter !== "all") {
    filtered = filtered.filter((m) => m.finding.severity === severityFilter);
  }
  filtered.sort((a, b) => SEV_ORDER.indexOf(a.finding.severity) - SEV_ORDER.indexOf(b.finding.severity));

  return (
    <div className="findings-section">
      <div className="section-label">FINDINGS</div>

      {/* Filters */}
      <div className="findings-filters">
        <select value={framework} onChange={(e) => setFramework(e.target.value)} className="findings-filter-select">
          <option value="all">All Frameworks</option>
          <option value="soc2">SOC 2</option>
          <option value="iso27001">ISO 27001</option>
          <option value="gdpr">GDPR</option>
          <option value="dpdp">DPDP</option>
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="findings-filter-select">
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <div className="findings-count">{filtered.length} finding{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Findings cards */}
      <div className="findings-table-wrapper">
        {filtered.length === 0 && <div className="ft-empty">No findings match the selected filters.</div>}
        {filtered.map((m, i) => {
          const f = m.finding;
          const sev = f.severity || "info";
          return (
            <div key={`${findingKey(f)}`} className={`fc fc--${sev}`}>
              <div className="fc__head">
                <span className={`sev-badge sev-badge--${sev}`}>{sev.toUpperCase()}</span>
                <span className="fc__tool">{TOOL_LABELS[f.tool] ?? f.tool}</span>
              </div>
              <div className="fc__body">
                <div className="fc__row">
                  <span className="fc__label">Risk</span>
                  <span className="fc__value">{f.title || "—"}</span>
                </div>
                <div className="fc__row">
                  <span className="fc__label">Impact</span>
                  <span className="fc__value">{f.description || "—"}</span>
                </div>
                <div className="fc__row">
                  <span className="fc__label">Evidence</span>
                  <span className="fc__value fc__value--mono">
                    {f.file_path ? (
                      <span className="fc__evidence">
                        <code>{f.file_path}</code>
                        {_extractLine(f.description) && (
                          <span className="fc__line">:{_extractLine(f.description)}</span>
                        )}
                      </span>
                    ) : (
                      <span className="ft-no-file">—</span>
                    )}
                  </span>
                </div>
                <div className="fc__row">
                  <span className="fc__label">Control</span>
                  <span className="fc__value fc__value--mono">
                    SOC2 {m.soc2_control?.control_id ?? "—"} &middot; ISO27001 {m.iso_control?.control_id ?? "—"}
                  </span>
                </div>
                {f.remediation && (
                  <div className="fc__row">
                    <span className="fc__label">Remediation</span>
                    <span className="fc__value">{f.remediation}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  semgrep: "SAST",
  osv: "OSV",
  github: "GitHub",
  secrets_pii: "Secrets",
  governance: "Governance",
  sbom: "SBOM",
  iac: "IaC",
  cicd: "CI/CD",
  data_classification: "Data Class",
};

function _extractLine(desc: string): string | null {
  // Many scanner descriptions contain ":<line>" near the end
  const m = desc.match(/:(\d+)\)?$/);
  return m ? m[1] : null;
}
