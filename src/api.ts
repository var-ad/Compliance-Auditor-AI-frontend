import type {
  AuditReport,
  AuditStatus,
  StartAuditResponse,
  StaticStatusResponse,
  UploadResponse,
} from "./types";

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
const defaultBase = import.meta.env.PROD ? "https://auditor.varad.fyi" : "";
const apiBase = configuredBase || defaultBase;
const BASE = `${apiBase.replace(/\/+$/, "")}/api`;
const API_KEY_STORAGE = "compliance-auditor-key";

export function getAccessKey(): string {
  return sessionStorage.getItem(API_KEY_STORAGE) ?? "";
}

export function setAccessKey(key: string): void {
  sessionStorage.setItem(API_KEY_STORAGE, key);
}

export function clearAccessKey(): void {
  sessionStorage.removeItem(API_KEY_STORAGE);
}

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
      const body = await resp.json() as { detail?: string; error?: string };
      detail = body.detail ?? body.error ?? detail;
    } catch {
      // ignore
    }
    if (resp.status === 401) {
      clearAccessKey();
      window.dispatchEvent(new Event("audit:unauthorized"));
    }
    throw new ApiError(resp.status, detail);
  }
  return resp.json() as Promise<T>;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const accessKey = getAccessKey();
  if (accessKey) headers.set("X-API-Key", accessKey);

  return fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });
}

export async function verifyAccessKey(key: string): Promise<void> {
  setAccessKey(key);
  try {
    await getStaticStatus();
  } catch (error) {
    clearAccessKey();
    throw error;
  }
}

/** POST /api/audit — synchronous audit (blocks until done). */
export async function startAuditSync(repoUrl: string): Promise<AuditReport> {
  const resp = await apiFetch("/audit", {
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
  const resp = await apiFetch("/audit/start", {
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
  const resp = await apiFetch(`/audit/${auditId}/status`);
  return handleResponse<AuditStatus>(resp);
}

/** GET /api/audit/{auditId}/results — fetch final report. */
export async function getAuditResults(
  auditId: string,
): Promise<AuditReport> {
  const resp = await apiFetch(`/audit/${auditId}/results`);
  return handleResponse<AuditReport>(resp);
}

/** GET /api/audit/status — get static node list. */
export async function getStaticStatus(): Promise<StaticStatusResponse> {
  const resp = await apiFetch("/audit/status");
  return handleResponse<StaticStatusResponse>(resp);
}

/** POST /api/audit/upload — upload a ZIP of a repository. */
export async function startAuditUpload(
  file: File,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const resp = await apiFetch("/audit/upload", {
    method: "POST",
    body: form,
  });
  return handleResponse<UploadResponse>(resp);
}
