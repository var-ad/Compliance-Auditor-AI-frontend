import React from "react";
import type { AuditReport } from "../types";

interface Props {
  report: AuditReport;
}

const FRAMEWORK_NAMES: Record<string, string> = {
  soc2: "SOC 2",
  iso27001: "ISO 27001",
  gdpr: "GDPR",
  dpdp: "DPDP",
};

function scoreClass(score: number): string {
  if (score >= 80) return "score--pass";
  if (score >= 50) return "score--warn";
  return "score--fail";
}

export default function ScoreCards({ report }: Props) {
  const scores = report.framework_scores;
  const frameworks = Object.keys(scores);

  return (
    <div className="score-cards">
      <div className="section-label">FRAMEWORK SCORES</div>
      <div className="score-cards__grid">
        {frameworks.map((fw) => {
          const score = scores[fw] ?? 0;
          const controls = report.frameworks[fw]?.controls_triggered ?? 0;
          return (
            <div
              key={fw}
              className={`score-card ${scoreClass(score)}`}
            >
              <div className="score-card__name">
                {FRAMEWORK_NAMES[fw] ?? fw.toUpperCase()}
              </div>
              <div className="score-card__value">{score}</div>
              <div className="score-card__controls">
                {controls} control{controls !== 1 ? "s" : ""} triggered
              </div>
              <div className="score-card__bar">
                <div
                  className="score-card__bar-fill"
                  style={{ width: `${Math.max(score, 5)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="overall-score">
        <span className="overall-score__label">Overall Score</span>
        <span
          className={`overall-score__value ${scoreClass(report.overall_score)}`}
        >
          {report.overall_score}
        </span>
        <span className="overall-score__out">/ 100</span>
      </div>
    </div>
  );
}
