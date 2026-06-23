import React, { useMemo, useState } from "react";
import type { AuditReport, Finding } from "../types";

interface Props {
  report: AuditReport;
}

interface DisplayControl {
  framework: string;
  control_id: string;
  control_name: string;
}

/** Merged finding with every framework/control mapping for that finding. */
interface MergedFinding {
  finding: Finding;
  controls: DisplayControl[];
  frameworks: string[];
}

function findingKey(f: Finding): string {
  return `${f.tool}|${f.rule_id ?? f.title}|${f.description}`;
}

const SEV_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export default function FindingsTable({ report }: Props) {
  const [framework, setFramework] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const merged = useMemo(() => {
    const map = new Map<string, MergedFinding>();

    for (const [fw, data] of Object.entries(report.frameworks)) {
      for (const mappedControl of data.findings) {
        const key = findingKey(mappedControl.finding);
        let entry = map.get(key);

        if (!entry) {
          entry = {
            finding: mappedControl.finding,
            controls: [],
            frameworks: [],
          };
          map.set(key, entry);
        }

        if (!entry.frameworks.includes(fw)) {
          entry.frameworks.push(fw);
        }

        const alreadyAdded = entry.controls.some(
          (control) =>
            control.framework === fw &&
            control.control_id === mappedControl.control_id,
        );

        if (!alreadyAdded) {
          entry.controls.push({
            framework: fw,
            control_id: mappedControl.control_id,
            control_name: mappedControl.control_name,
          });
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

      <div className="findings-table-wrapper">
        {filtered.length === 0 && <div className="ft-empty">No findings match the selected filters.</div>}
        {filtered.map((m) => {
          const f = m.finding;
          const sev = f.severity || "info";
          return (
            <div key={findingKey(f)} className={`fc fc--${sev}`}>
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
                  <span className="fc__label">Controls</span>
                  <span className="fc__value fc__controls">
                    {m.controls.length > 0 ? (
                      m.controls.map((control) => (
                        <span
                          key={`${control.framework}:${control.control_id}`}
                          className="control-chip"
                          title={control.control_name}
                        >
                          <span className="control-chip__framework">
                            {FRAMEWORK_LABELS[control.framework] ?? control.framework}
                          </span>
                          <span className="control-chip__id">{control.control_id}</span>
                        </span>
                      ))
                    ) : (
                      <span className="ft-no-file">—</span>
                    )}
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

const FRAMEWORK_LABELS: Record<string, string> = {
  soc2: "SOC 2",
  iso27001: "ISO 27001",
  gdpr: "GDPR",
  dpdp: "DPDP",
};

function _extractLine(desc: string): string | null {
  // Many scanner descriptions contain ":<line>" near the end.
  const m = desc.match(/:(\d+)\)?$/);
  return m?.[1] ?? null;
}
