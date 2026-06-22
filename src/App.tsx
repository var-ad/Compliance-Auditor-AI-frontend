import React, { useCallback, useRef } from "react";
import type { InputType } from "./types";
import { useAudit } from "./useAudit";
import PipelineProgress from "./components/PipelineProgress";
import ScoreCards from "./components/ScoreCards";
import SeverityBreakdown from "./components/SeverityBreakdown";
import ExecutiveSummary from "./components/ExecutiveSummary";
import FindingsTable from "./components/FindingsTable";
import "./App.css";

const INPUT_OPTIONS: { value: InputType; label: string }[] = [
  { value: "github", label: "GitHub" },
  { value: "git",    label: "Git URL" },
  { value: "zip",    label: "Upload ZIP" },
];

export default function App() {
  const {
    phase,
    inputType,
    setInputType,
    repoUrl,
    setRepoUrl,
    selectedFile,
    setSelectedFile,
    startAudit,
    cancelAudit,
    nodes,
    report,
    error,
    elapsed,
  } = useAudit();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = phase === "running" || phase === "starting";

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      startAudit();
    },
    [startAudit],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSelectedFile(e.target.files?.[0] ?? null);
    },
    [setSelectedFile],
  );

  const canSubmit = inputType === "zip"
    ? selectedFile !== null
    : repoUrl.trim().length > 0;

  return (
    <div className="app">
      {/* ── Header ────────────────────────────────── */}
      <header className="header">
        <div className="header__top">
          <div className="header__brand">
            <span className="header__logo">CA</span>
            <div>
              <div className="header__title">Compliance Auditor</div>
              <div className="header__subtitle">
                SOC 2 · ISO 27001 · GDPR · DPDP
              </div>
            </div>
          </div>
        </div>

        {/* ── Input type tabs ────────────────────── */}
        <div className="input-tabs">
          {INPUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`input-tab ${inputType === opt.value ? "input-tab--active" : ""}`}
              onClick={() => { setInputType(opt.value); setSelectedFile(null); }}
              disabled={isBusy}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Input form ─────────────────────────── */}
        <form className="header__form" onSubmit={handleSubmit}>
          {inputType === "zip" ? (
            <div className="header__input-group">
              <div className="file-input-wrapper">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="file-input"
                  onChange={handleFileChange}
                  disabled={isBusy}
                />
                <span className="file-input-label">
                  {selectedFile ? selectedFile.name : "Choose a .zip file..."}
                </span>
              </div>
              {isBusy ? (
                <button type="button" className="header__btn header__btn--cancel" onClick={cancelAudit}>
                  Cancel
                </button>
              ) : (
                <button type="submit" className="header__btn header__btn--audit" disabled={!canSubmit}>
                  Audit
                </button>
              )}
            </div>
          ) : (
            <div className="header__input-group">
              <input
                type="text"
                className="header__input"
                placeholder={
                  inputType === "github"
                    ? "https://github.com/owner/repo"
                    : "https://gitlab.com/owner/repo or any git URL"
                }
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={isBusy}
              />
              {isBusy ? (
                <button type="button" className="header__btn header__btn--cancel" onClick={cancelAudit}>
                  Cancel
                </button>
              ) : (
                <button type="submit" className="header__btn header__btn--audit" disabled={!canSubmit}>
                  Audit
                </button>
              )}
            </div>
          )}
        </form>
      </header>

      {/* ── Pipeline Progress ─────────────────────── */}
      <PipelineProgress nodes={nodes} elapsed={elapsed} phase={phase} />

      {/* ── Error ─────────────────────────────────── */}
      {error && (
        <div className="error-banner">
          <div className="error-banner__icon">!</div>
          <div className="error-banner__text">{error}</div>
        </div>
      )}

      {/* ── Results ───────────────────────────────── */}
      {report && (
        <div className="results">
          <ScoreCards report={report} />

          <div className="results__columns">
            <div className="results__col-main">
              <ExecutiveSummary summary={report.executive_summary} />
              <FindingsTable report={report} />
            </div>
            <div className="results__col-side">
              <SeverityBreakdown
                severity_breakdown={report.severity_breakdown}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────── */}
      <footer className="footer">
        <span>Compliance Auditor v1.0</span>
        <span>Powered by LangGraph · Groq · Supabase</span>
      </footer>
    </div>
  );
}
