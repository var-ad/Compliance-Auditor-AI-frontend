import type {
  AuditReport,
  AuditStatus,
  StartAuditResponse,
  StaticStatusResponse,
  UploadResponse,
} from "./types";

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body.detail) detail = body.detail;
    } catch {
      // ignore
    }
    throw new ApiError(resp.status, detail);
  }
  return resp.json() as Promise<T>;
}

/** POST /api/audit — synchronous audit (blocks until done). */
export async function startAuditSync(repoUrl: string): Promise<AuditReport> {
  const resp = await fetch(`${BASE}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_url: repoUrl }),
  });
  return handleResponse<AuditReport>(resp);
}

/** POST /api/audit/start — async audit, returns audit_id immediately. */
export async function startAuditAsync(
  repoUrl: string,
): Promise<StartAuditResponse> {
  const resp = await fetch(`${BASE}/audit/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_url: repoUrl }),
  });
  return handleResponse<StartAuditResponse>(resp);
}

/** GET /api/audit/{auditId}/status — poll node-level progress. */
export async function getAuditStatus(
  auditId: string,
): Promise<AuditStatus> {
  const resp = await fetch(`${BASE}/audit/${auditId}/status`);
  return handleResponse<AuditStatus>(resp);
}

/** GET /api/audit/{auditId}/results — fetch final report. */
export async function getAuditResults(
  auditId: string,
): Promise<AuditReport> {
  const resp = await fetch(`${BASE}/audit/${auditId}/results`);
  return handleResponse<AuditReport>(resp);
}

/** GET /api/audit/status — get static node list. */
export async function getStaticStatus(): Promise<StaticStatusResponse> {
  const resp = await fetch(`${BASE}/audit/status`);
  return handleResponse<StaticStatusResponse>(resp);
}

/** POST /api/audit/upload — upload a ZIP of a repository. */
export async function startAuditUpload(
  file: File,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${BASE}/audit/upload`, {
    method: "POST",
    body: form,
  });
  return handleResponse<UploadResponse>(resp);
}

