import React from "react";

interface Props {
  summary: string;
}

export default function ExecutiveSummary({ summary }: Props) {
  if (!summary) return null;

  return (
    <div className="executive-summary">
      <div className="section-label">EXECUTIVE SUMMARY</div>
      <p>{summary}</p>
    </div>
  );
}
