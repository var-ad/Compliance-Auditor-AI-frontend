import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAuditResults,
  getAuditStatus,
  startAuditAsync,
  startAuditSync,
  startAuditUpload,
} from "./api";
import type {
  AuditReport,
  AuditStatus,
  InputType,
  NodeStatus,
} from "./types";
import { ALL_NODES, GRAPH_EDGES } from "./types";

// ── Helper: build adjacency list from edges ─────────────────────────────

function buildPredecessors(): Record<string, string[]> {
  const pred: Record<string, string[]> = {};
  for (const node of ALL_NODES) pred[node] = [];
  for (const edge of GRAPH_EDGES) {
    pred[edge.to].push(edge.from);
  }
  return pred;
}

const PREDECESSORS = buildPredecessors();

// ── Types ───────────────────────────────────────────────────────────────

export type AuditPhase = "idle" | "starting" | "running" | "done" | "error";

export interface NodeState {
  name: string;
  status: NodeStatus;
  error: string | null;
}

export interface UseAuditReturn {
  phase: AuditPhase;
  inputType: InputType;
  setInputType: (t: InputType) => void;
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  startAudit: () => void;
  cancelAudit: () => void;
  nodes: NodeState[];
  report: AuditReport | null;
  error: string | null;
  elapsed: number;
}

const POLL_INTERVAL_MS = 1000;

// ── Hook ────────────────────────────────────────────────────────────────

export function useAudit(): UseAuditReturn {
  const [phase, setPhase] = useState<AuditPhase>("idle");
  const [inputType, setInputType] = useState<InputType>("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [nodes, setNodes] = useState<NodeState[]>(() =>
    ALL_NODES.map((name) => ({ name, status: "pending", error: null })),
  );
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const auditIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  // ── Infer running nodes from graph topology ───────────────────────────

  const inferRunningNodes = useCallback(
    (completed: Set<string>, errored: Set<string>) => {
      const inferred: string[] = [];
      for (const node of ALL_NODES) {
        if (completed.has(node) || errored.has(node)) continue;
        const predecessors = PREDECESSORS[node];
        const allPredDone = predecessors.every(
          (p) => completed.has(p) || errored.has(p),
        );
        if (allPredDone) {
          inferred.push(node);
        }
      }
      return inferred;
    },
    [],
  );

  // ── Update nodes from backend status ──────────────────────────────────

  const updateFromStatus = useCallback((status: AuditStatus) => {
    const completed = new Set<string>();
    const errored = new Set<string>();

    const updated: NodeState[] = ALL_NODES.map((name) => {
      const remote = status.nodes.find((n) => n.name === name);
      if (!remote) return { name, status: "pending", error: null };

      if (remote.status === "completed") completed.add(name);
      if (remote.status === "error") errored.add(name);

      return {
        name: remote.name,
        status: remote.status as NodeStatus,
        error: remote.error,
      };
    });

    const runningInferred = inferRunningNodes(completed, errored);
    for (const node of updated) {
      if (
        node.status === "pending" &&
        runningInferred.includes(node.name)
      ) {
        node.status = "running";
      }
    }

    setNodes(updated);
  }, [inferRunningNodes]);

  // ── Reset to initial state ────────────────────────────────────────────

  const resetState = useCallback(() => {
    setNodes(ALL_NODES.map((name) => ({ name, status: "pending", error: null })));
    setReport(null);
    setError(null);
    setElapsed(0);
    setPhase("idle");
    cancelledRef.current = false;
  }, []);

  // ── Poll loop ─────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (auditId: string) => {
      try {
        const status = await getAuditStatus(auditId);
        updateFromStatus(status);

        if (status.status === "completed" || status.status === "error") {
          stopPolling();
          setPhase(status.status === "completed" ? "done" : "error");

          try {
            const results = await getAuditResults(auditId);
            setReport(results);
            if (results.error) setError(results.error);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to fetch results";
            setError(msg);
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Poll error";
        console.warn("Poll failed:", msg);
      }
    },
    [updateFromStatus, stopPolling],
  );

  // ── Start audit ───────────────────────────────────────────────────────

  const startAudit = useCallback(async () => {
    if (inputType === "zip") {
      if (!selectedFile) return;
    } else {
      if (!repoUrl.trim()) return;
    }

    resetState();
    setPhase("starting");
    cancelledRef.current = false;
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 200);

    try {
      let auditId: string;

      if (inputType === "zip") {
        const resp = await startAuditUpload(selectedFile!);
        auditId = resp.audit_id;
      } else {
        // github / git — async clone, fall back to sync
        try {
          const resp = await startAuditAsync(repoUrl.trim());
          auditId = resp.audit_id;
        } catch {
          const report = await startAuditSync(repoUrl.trim());
          setReport(report);
          setPhase("done");
          setNodes(
            ALL_NODES.map((name) => ({
              name,
              status: "completed" as NodeStatus,
              error: null,
            })),
          );
          stopPolling();
          return;
        }
      }

      auditIdRef.current = auditId;
      setPhase("running");

      pollRef.current = setInterval(() => {
        if (auditIdRef.current && !cancelledRef.current) {
          pollStatus(auditIdRef.current);
        }
      }, POLL_INTERVAL_MS);

      pollStatus(auditId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Audit failed";
      setError(msg);
      setPhase("error");
      stopPolling();
    }
  }, [inputType, repoUrl, selectedFile, resetState, pollStatus, stopPolling]);

  // ── Cancel ────────────────────────────────────────────────────────────

  const cancelAudit = useCallback(() => {
    cancelledRef.current = true;
    stopPolling();
    resetState();
  }, [stopPolling, resetState]);

  // ── Cleanup on unmount ────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
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
  };
}
