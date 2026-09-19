/**
 * Connected note sources (Google Docs, OneNote, Notion, …).
 * Mirrors playstudy-backend/app/api/sources.py.
 */
import { authService } from "./authService";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export type SourceProvider = "google" | "microsoft" | "notion" | null;

export interface NoteSource {
  id: string;
  name: string;
  description: string;
  provider: SourceProvider;
  /** import-only source (no OAuth) */
  manual: boolean;
  /** provider credentials exist on this server */
  configured: boolean;
  connected: boolean;
  account: string | null;
  connected_at: string | null;
}

function headers(): Record<string, string> {
  const token = authService.getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function listSources(): Promise<NoteSource[]> {
  const res = await fetch(`${API_URL}/sources`, { headers: headers() });
  if (!res.ok) throw new Error("Could not load sources");
  return (await res.json()).sources;
}

/**
 * Start connecting a source. Resolves to:
 *  - { manual: true }  → open the upload / import UI instead
 *  - { url }           → the browser was sent to the provider (no further action)
 * Rejects with the server's message when the provider isn't configured.
 */
export async function connectSource(id: string, next = "/dashboard"): Promise<{ manual?: boolean; url?: string }> {
  const res = await fetch(`${API_URL}/sources/${id}/connect?next=${encodeURIComponent(next)}`, { method: "POST", headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Could not start the connection");
  if (data.url) window.location.href = data.url;
  return data;
}

export async function disconnectSource(id: string): Promise<void> {
  await fetch(`${API_URL}/sources/${id}`, { method: "DELETE", headers: headers() });
}
