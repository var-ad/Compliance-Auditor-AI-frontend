import React, { useMemo, useRef, useEffect, useState } from "react";
import type { NodeState, NodeStatus } from "../types";
import { ALL_NODES, GRAPH_EDGES, NODE_LABELS } from "../types";

// ── Layout configuration ────────────────────────────────────────────────

interface LayoutNode {
  name: string;
  label: string;
  status: NodeStatus;
  error: string | null;
  row: number;
  col: number;
}

interface LayoutEdge {
  from: LayoutNode;
  to: LayoutNode;
  isActive: boolean;
  isAnimated: boolean;
}

/** Position each node in a grid for the DAG layout */
const NODE_POSITIONS: Record<string, [col: number, row: number]> = {
  orchestrator: [0, 1],
  fan_out: [1, 1],
  // All 9 scanners in column 2, stacked vertically
  semgrep: [3, 0],
  osv: [3, 1],
  github: [3, 2],
  scan_secrets_pii: [3, 3],
  scan_repo_governance: [3, 4],
  scan_sbom_license: [3, 5],
  scan_iac_config: [3, 6],
  scan_cicd_security: [3, 7],
  scan_data_classification: [3, 8],
  scanner_merge: [6, 1],
  compliance_mapper: [7, 1],
  report_generator: [8, 1],
};

const NUM_COLS = 10;

// ── PipelineProgress component ──────────────────────────────────────────

interface Props {
  nodes: NodeState[];
  elapsed: number;
  phase: string;
}

export default function PipelineProgress({ nodes, elapsed, phase }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Build layout data
  const layout = useMemo(() => {
    const nodeMap = new Map<string, LayoutNode>();
    for (const n of nodes) {
      const pos = NODE_POSITIONS[n.name] ?? [0, 0];
      nodeMap.set(n.name, {
        name: n.name,
        label: NODE_LABELS[n.name] ?? n.name,
        status: n.status,
        error: n.error,
        row: pos[1],
        col: pos[0],
      });
    }

    const edges: LayoutEdge[] = GRAPH_EDGES.map((e) => {
      const from = nodeMap.get(e.from);
      const to = nodeMap.get(e.to);
      if (!from || !to) return null;
      const isActive = from.status === "completed" || from.status === "running";
      const isAnimated =
        from.status === "running" ||
        to.status === "running" ||
        (to.status === "pending" && from.status === "completed");
      return { from, to, isActive, isAnimated };
    }).filter(Boolean) as LayoutEdge[];

    return { nodes: [...nodeMap.values()], edges };
  }, [nodes]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="pipeline-section">
      <div className="pipeline-header">
        <span className="pipeline-title">Pipeline Execution</span>
        <span className="pipeline-phase-label">
          {phase === "idle" && "AWAITING INPUT"}
          {phase === "starting" && "INITIALIZING"}
          {phase === "running" && `RUNNING · ${formatTime(elapsed)}`}
          {phase === "done" && `COMPLETED · ${formatTime(elapsed)}`}
          {phase === "error" && "FAILED"}
        </span>
      </div>

      <div className="pipeline-scroll" ref={containerRef}>
        <div
          className="pipeline-grid"
          style={{ gridTemplateColumns: `repeat(${NUM_COLS}, auto)` }}
        >
          {/* Phase labels */}
          <PhaseLabel col={0} text="SETUP" />
          <PhaseLabel col={3} text="SCAN" />
          <PhaseLabel col={6} text="MERGE" />
          <PhaseLabel col={7} text="MAP" />
          <PhaseLabel col={8} text="REPORT" />

          {/* Edges (SVG overlay) */}
          <svg
            className="pipeline-svg"
            style={{
              gridColumn: `1 / ${NUM_COLS + 1}`,
              gridRow: "1 / 20",
            }}
          >
            {layout.edges.map((edge, i) => (
              <EdgePath key={i} edge={edge} containerRef={containerRef} />
            ))}
          </svg>

          {/* Nodes */}
          {layout.nodes.map((node) => (
            <NodeCard key={node.name} node={node} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function PhaseLabel({ col, text }: { col: number; text: string }) {
  return (
    <div className="phase-label" style={{ gridColumn: col + 1, gridRow: 1 }}>
      {text}
    </div>
  );
}

function NodeCard({ node }: { node: LayoutNode }) {
  const col = node.col + 1;
  const row = node.row + 2; // offset for phase label row

  return (
    <div
      className={`pipeline-node pipeline-node--${node.status}`}
      data-node={node.name}
      style={{ gridColumn: col, gridRow: row }}
      title={node.error ? `Error: ${node.error}` : node.label}
    >
      <div className="pipeline-node__status-dot" />
      <div className="pipeline-node__name">{node.label}</div>
      <div className="pipeline-node__status-label">
        {statusLabel(node.status)}
      </div>
    </div>
  );
}

function statusLabel(status: NodeStatus): string {
  switch (status) {
    case "pending":
      return "PENDING";
    case "running":
      return "RUNNING";
    case "completed":
      return "DONE";
    case "error":
      return "FAILED";
    case "skipped":
      return "SKIPPED";
  }
}

function EdgePath({
  edge,
  containerRef,
}: {
  edge: LayoutEdge;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  // We need to compute the line between two node cards.
  // Since we use CSS grid, we'll approximate positions based on column/row indices.
  // For a more accurate approach, use ResizeObserver on the container and
  // compute from getBoundingClientRect of actual node elements.

  const [path, setPath] = useState<string>("");
  const nodeElements = useRef<Map<string, DOMRect>>(new Map());

  useEffect(() => {
    const compute = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const fromEl = container.querySelector(`[data-node="${edge.from.name}"]`);
      const toEl = container.querySelector(`[data-node="${edge.to.name}"]`);
      if (!fromEl || !toEl) return;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();

      // Simple elbow path: right edge of from → left edge of to
      const x1 = fromRect.right - cRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - cRect.top;
      const x2 = toRect.left - cRect.left;
      const y2 = toRect.top + toRect.height / 2 - cRect.top;

      // If same row: straight horizontal line
      // If different row: elbow connector
      const midX = (x1 + x2) / 2;
      setPath(
        `M ${x1} ${y1} ` +
          `L ${midX} ${y1} ` +
          `L ${midX} ${y2} ` +
          `L ${x2} ${y2}`,
      );
    };

    compute();
    const observer = new ResizeObserver(compute);
    if (containerRef.current) observer.observe(containerRef.current);
    // Also check after a short delay for layout settling
    const timer = setTimeout(compute, 100);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [edge, containerRef]);

  return (
    <path
      d={path}
      className={`pipeline-edge ${
        edge.isActive ? "pipeline-edge--active" : ""
      } ${edge.isAnimated ? "pipeline-edge--animated" : ""}`}
      fill="none"
      strokeWidth="1.5"
    />
  );
}

// ── Helper ──────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
