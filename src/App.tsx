import React, { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, clearAccessKey, getAccessKey, verifyAccessKey } from "./api";
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
  { value: "git", label: "Git URL" },
  { value: "zip", label: "Upload ZIP" },
];

export default function App() {
  const [accessKey, setAccessKeyInput] = useState(() => getAccessKey());
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
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

  useEffect(() => {
    const handleUnauthorized = () => {
      setAccessKeyInput("");
      setAuthError(
        "Access key is invalid or expired. Enter it again to continue.",
      );
    };

    window.addEventListener("audit:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("audit:unauthorized", handleUnauthorized);
    };
  }, []);

  const verifyCurrentAccessKey = useCallback(async () => {
    const key = accessKey.trim();
    if (!key) {
      setAuthError("Enter the access key before starting an audit.");
      return false;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    try {
      await verifyAccessKey(key);
      return true;
    } catch (loginError) {
      setAuthError(
        loginError instanceof ApiError && loginError.status === 401
          ? "Invalid access key."
          : "Could not reach the auditor service. Please try again.",
      );
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [accessKey]);

  const handleClearAccessKey = useCallback(() => {
    if (isBusy) cancelAudit();
    clearAccessKey();
    setAccessKeyInput("");
    setAuthError(null);
  }, [cancelAudit, isBusy]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const isKeyValid = await verifyCurrentAccessKey();
      if (!isKeyValid) return;
      startAudit();
    },
    [startAudit, verifyCurrentAccessKey],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSelectedFile(e.target.files?.[0] ?? null);
    },
    [setSelectedFile],
  );

  const canSubmit =
    inputType === "zip" ? selectedFile !== null : repoUrl.trim().length > 0;
  const canStartAudit =
    canSubmit && accessKey.trim().length > 0 && !isAuthenticating;

  return (
    <div className="app">
      <header className="header">
        <div className="header__top">
          <div className="header__brand">
            <span className="header__logo">CA</span>
            <div>
              <div className="header__title">Compliance Auditor AI</div>
              <div className="header__subtitle">
                SOC 2 · ISO 27001 · GDPR · DPDP
              </div>
            </div>
          </div>
          <button
            type="button"
            className="header__logout"
            onClick={handleClearAccessKey}
            disabled={!accessKey && !getAccessKey()}
          >
            Clear key
          </button>
        </div>

        <div className="input-tabs">
          {INPUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`input-tab ${inputType === opt.value ? "input-tab--active" : ""}`}
              onClick={() => {
                setInputType(opt.value);
                setSelectedFile(null);
              }}
              disabled={isBusy}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <form className="header__form" onSubmit={handleSubmit}>
          <div className="access-key-row">
            <label className="access-key-row__label" htmlFor="access-key">
              Access key
            </label>
            <input
              id="access-key"
              type="password"
              className="header__input access-key-row__input"
              value={accessKey}
              onChange={(e) => {
                setAccessKeyInput(e.target.value);
                if (authError) setAuthError(null);
              }}
              placeholder="Required to run audits"
              autoComplete="current-password"
              disabled={isBusy || isAuthenticating}
            />
            <span className="access-key-row__hint">
              Access is restricted to control API costs and server usage. Please
              obtain an access key from Varad.
            </span>
          </div>
          {authError && (
            <div className="access-key-row__error">{authError}</div>
          )}

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
                <button
                  type="button"
                  className="header__btn header__btn--cancel"
                  onClick={cancelAudit}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="submit"
                  className="header__btn header__btn--audit"
                  disabled={!canStartAudit}
                >
                  {isAuthenticating ? "Checking..." : "Audit"}
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
                <button
                  type="button"
                  className="header__btn header__btn--cancel"
                  onClick={cancelAudit}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="submit"
                  className="header__btn header__btn--audit"
                  disabled={!canStartAudit}
                >
                  {isAuthenticating ? "Checking..." : "Audit"}
                </button>
              )}
            </div>
          )}
        </form>
      </header>

      <PipelineProgress nodes={nodes} elapsed={elapsed} phase={phase} />

      {error && (
        <div className="error-banner">
          <div className="error-banner__icon">!</div>
          <div className="error-banner__text">{error}</div>
        </div>
      )}

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

      <footer className="footer">
        <span>Compliance Auditor AI</span>
      </footer>
    </div>
  );
}
