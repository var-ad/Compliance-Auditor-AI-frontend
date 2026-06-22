# Compliance Auditor — Frontend

React + TypeScript dashboard for the [Compliance Auditor AI](../compliance-auditor/) backend. Displays real-time pipeline progress, per-framework scores, and enterprise-grade findings cards.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api/*` to `localhost:8000` (configured in `vite.config.ts`). Make sure the backend is running:

```bash
# In a separate terminal:
cd ../compliance-auditor
uv run uvicorn app.main:app --port 8000 --reload
```

## Build for Production

```bash
npm run build
# Output in dist/
```

Serve the `dist/` folder from the backend's FastAPI server, or deploy to Vercel / Cloudflare Pages / S3.

## Architecture

### State Management
Single `useAudit()` React hook manages the full audit lifecycle:

- **Input types**: GitHub URL, any git URL, ZIP upload (file picker)
- **Phases**: idle → starting → running (polling) → done / error
- **Polling**: 1s interval to `GET /api/audit/{id}/status` for node-level progress
- **Results**: Fetch via `GET /api/audit/{id}/results` when status is complete

### Input Sources

| Tab | What it sends |
|-----|--------------|
| GitHub | `POST /api/audit/start` with `https://github.com/owner/repo` |
| Git URL | `POST /api/audit/start` with any git URL |
| Upload ZIP | `POST /api/audit/upload` with `.zip` file (multipart) |

### Pipeline DAG
The `PipelineProgress` component renders a CSS Grid layout of all 14 LangGraph nodes:

- 10 columns × 20 rows with SVG edge connectors
- Node states: pending (gray), running (pulsing red), completed (green), error (red), skipped (dashed)
- Phase labels: SETUP, SCAN (9 nodes stacked), MERGE, MAP, REPORT
- Topology inference: when all predecessors are done, pending nodes briefly show "running"

### Findings Table
Enterprise-style finding cards instead of a flat table:

| Field | Source |
|-------|--------|
| Risk | Finding title |
| Impact | Finding description |
| Evidence | File path + extracted line number |
| Control | SOC2 + ISO27001 control IDs (merged from mapped controls) |
| Remediation | Per-finding-type text from `REMEDIATION_MAP` (57 types) |

SOC2 and ISO controls are stored separately per finding and merged at display time — the old bug where ISO showed SOC2 control IDs is fixed.

### Design

- **Palette**: White background, near-black text, red/green/amber severity accents
- **Typography**: Space Grotesk (display), Inter (body), JetBrains Mono (code)
- **Layout**: Max 1280px, 3px border-radius, thin borders, no shadows

## Project Structure

```
src/
├── App.tsx                     # Main layout: input tabs, pipeline, results
├── App.css                     # All styles (design tokens, pipeline DAG, cards)
├── main.tsx                    # React entry point
├── types.ts                    # TypeScript interfaces (Finding, AuditReport, etc.)
├── api.ts                      # Fetch-based API client
├── useAudit.ts                 # Audit lifecycle hook
└── components/
    ├── PipelineProgress.tsx     # 14-node DAG visualization
    ├── ScoreCards.tsx           # 4 framework scores + overall
    ├── SeverityBreakdown.tsx    # Bar chart by severity
    ├── ExecutiveSummary.tsx     # LLM summary text
    └── FindingsTable.tsx        # Enterprise finding cards
```
