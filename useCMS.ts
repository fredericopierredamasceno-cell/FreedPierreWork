import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { CMSData, UploadProgress, LogEntry, PublishStep, SaveStatus } from "../lib/types";
import { makeCMSData } from "../lib/defaults";
import { requireSupabase, supabase } from "../lib/supabase";

const CMS_API = "/api/cms";
async function api(action: string, payload: Record<string, unknown> = {}) {
  const session = (await requireSupabase().auth.getSession()).data.session;
  if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch(CMS_API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action, ...payload }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "A operação segura falhou.");
  return body;
}

export function useCMS() {
  const [cms, setCms] = useState<CMSData>(makeCMSData);
  const [loading, setLoading] = useState(true); const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle"); const [saveError, setSaveError] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]); const [publishSteps, setPublishSteps] = useState<PublishStep[]>([]); const [publishOpen, setPublishOpen] = useState(false);
  const addLog = useCallback((level: LogEntry["level"], msg: string) => setLogs(prev => [{ id: `${Date.now()}-${Math.random()}`, ts: new Date(), level, msg }, ...prev].slice(0, 100)), []);
  useEffect(() => { Object.entries(cms.theme).forEach(([key, value]) => document.documentElement.style.setProperty(`--${key}`, value)); }, [cms.theme]);
  const syncFromGitHub = useCallback(async () => {
    try { const response = await fetch(CMS_API); if (!response.ok) throw new Error(); const data = await response.json(); setCms(makeCMSData(data)); addLog("success", "Conteúdo sincronizado."); return true; }
    catch { toast.error("Não foi possível carregar o conteúdo publicado."); return false; }
  }, [addLog]);
  useEffect(() => { syncFromGitHub().finally(() => setLoading(false)); }, [syncFromGitHub]);
  const publish = useCallback(async (data: CMSData) => {
    const steps: PublishStep[] = [{ id: "validate", label: "Validando dados…", status: "pending" }, { id: "commit", label: "Salvando conteúdo com segurança…", status: "pending" }, { id: "done", label: "Conteúdo publicado.", status: "pending" }];
    setPublishSteps(steps); setPublishOpen(true); setSaveStatus("saving"); setSaveError("");
    try { setPublishSteps(s => s.map(x => x.id === "validate" ? { ...x, status: "done" } : x.id === "commit" ? { ...x, status: "running" } : x)); await api("publish", { data: { ...data, updatedAt: new Date().toISOString() } }); setCms({ ...data, updatedAt: new Date().toISOString() }); setPublishSteps(s => s.map(x => ({ ...x, status: "done" }))); setSaveStatus("success"); addLog("success", "Conteúdo publicado pelo servidor seguro."); toast.success("Publicado com segurança."); return true; }
    catch (error) { const message = error instanceof Error ? error.message : "Falha ao publicar."; setSaveStatus("error"); setSaveError(message); addLog("error", message); toast.error(message); return false; }
  }, [addLog]);
  const uploadFile = useCallback(async (file: File, type: "image" | "video" | "audio", onProgress: (p: UploadProgress) => void) => {
    try {
      const client = requireSupabase(); const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const path = `${type}/${crypto.randomUUID()}-${safeName}`;
      onProgress({ phase: "preparing", percent: 10, bytesSent: 0, bytesTotal: file.size, speed: 0, eta: 0 });
      const { error } = await client.storage.from("cms-media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = client.storage.from("cms-media").getPublicUrl(path);
      onProgress({ phase: "done", percent: 100, bytesSent: file.size, bytesTotal: file.size, speed: 0, eta: 0 }); return data.publicUrl;
    } catch (error) { const message = error instanceof Error ? error.message : "Falha no upload."; toast.error(message); onProgress({ phase: "error", percent: 0, bytesSent: 0, bytesTotal: file.size, speed: 0, eta: 0 }); return null; }
  }, []);
  const deleteFile = useCallback(async (url: string) => { if (!url) return; try { await api("delete-media", { url }); } catch { /* conteúdo continua preservado se a remoção física falhar */ } }, []);
  return { ghConfig: { owner: "Servidor", repo: "protegido", branch: "cms-data" }, setGhConfig: () => {}, clearGhConfig: () => {}, clearToken: () => {}, cms, setCms, loading, saveStatus, saveError, logs, addLog, publishSteps, publishOpen, setPublishOpen, publish, uploadFile, deleteFile, syncFromGitHub, silentSave: async (data: CMSData) => { await publish(data); } };
}
