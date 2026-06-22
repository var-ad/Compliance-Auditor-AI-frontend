import React from "react";
import type { AuditReport } from "../types";

interface Props {
  severity_breakdown: AuditReport["severity_breakdown"];
}

const SEV_ORDER = ["critical", "high", "medium", "low", "info"] as const;
const SEV_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};
const SEV_COLORS: Record<string, string> = {
  critical: "#DC3545",
  high: "#FD7E14",
  medium: "#FFC107",
  low: "#0D6EFD",
  info: "#6C757D",
};

export default function SeverityBreakdown({
  severity_breakdown,
}: Props) {
  const total = Object.values(severity_breakdown).reduce(
    (a, b) => a + b,
    0,
  );
  const maxCount = Math.max(
    ...SEV_ORDER.map((s) => severity_breakdown[s] ?? 0),
    1,
  );

  return (
    <div className="severity-section">
      <div className="section-label">SEVERITY BREAKDOWN</div>
      <div className="severity-count">{total} finding{total !== 1 ? "s" : ""}</div>
      <div className="severity-bars">
        {SEV_ORDER.map((sev) => {
          const count = severity_breakdown[sev] ?? 0;
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={sev} className="severity-row">
              <div className="severity-row__label">
                <span
                  className="severity-row__dot"
                  style={{ backgroundColor: SEV_COLORS[sev] }}
                />
                {SEV_LABELS[sev]}
              </div>
              <div className="severity-row__bar-track">
                <div
                  className="severity-row__bar-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: SEV_COLORS[sev],
                  }}
                />
              </div>
              <div className="severity-row__count">{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
