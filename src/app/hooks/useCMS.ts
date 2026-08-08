import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { GitHubConfig, CMSData, UploadProgress, LogEntry, PublishStep, SaveStatus } from "../lib/types";
import { makeCMSData } from "../lib/defaults";
import {
  CMS_BRANCH, CMS_FILE, PUBLIC_CFG_PATH,
  loadGHConfig, storeGHConfig, clearGHConfig, clearGHTokenOnly, loadPublicConfig,
  GH_HEADERS, ghEnsureCMSBranch, ghWriteCMSFile, ghCommitCMS, ghFetchCMS,
} from "../lib/github";
import { getActiveStorageProvider } from "../lib/storage";
export function useCMS() {
  const [ghConfig, setGhConfigState] = useState<GitHubConfig | null>(loadGHConfig);
  const [cms, setCms] = useState<CMSData>(makeCMSData);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [publishSteps, setPublishSteps] = useState<PublishStep[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);

  const addLog = useCallback((level: LogEntry["level"], msg: string) => {
    setLogs(prev => [{ id: `${Date.now()}-${Math.random()}`, ts: new Date(), level, msg }, ...prev].slice(0, 100));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cms.theme).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  }, [cms.theme]);

  useEffect(() => {
    addLog("info", "Carregando portfólio...");

    async function runFetch() {
      let cfg = loadGHConfig();
      if (!cfg?.owner) {
        // Dispositivo sem config local (ex: mobile) — tenta descobrir repo via /cms-config.json
        const pub = await loadPublicConfig();
        if (pub) {
          cfg = { ...pub, token: "" };
          addLog("info", "Config pública detectada — lendo cms-data sem token.");
        }
      }
      if (cfg?.owner && cfg?.repo) {
        addLog("info", `Sincronizando GitHub (${cfg.owner}/${cfg.repo}) — branch '${CMS_BRANCH}'.`);
        try {
          const result = await ghFetchCMS(cfg);
          if (result) {
            setCms(result.data);
            setLoading(false);
            if (result.fromBackup) {
              addLog("warn", "⚠ bkp.json restaurou os dados — regravando data.json.");
              toast.info("Dados admin restaurados do backup automaticamente.", { duration: 4000 });
              if (cfg.token) ghWriteCMSFile(cfg as GitHubConfig, CMS_FILE, result.data, "RESTORE: bkp->data [auto]").catch(() => {});
            } else {
              addLog("success", "✓ CMS carregado do branch cms-data.");
            }
          } else {
            addLog("warn", "Branch cms-data vazio — usando defaults."); fetchLocal();
          }
        } catch { fetchLocal(); }
      } else { fetchLocal(); }
    }

    function fetchLocal() {
      fetch(`/cms-data.json?t=${Date.now()}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(d => { setCms(makeCMSData(d)); setLoading(false); addLog("success", "Fallback local carregado."); })
        .catch(() => { setLoading(false); addLog("warn", "Usando padrões iniciais."); });
    }

    runFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setGhConfig = useCallback((cfg: GitHubConfig) => { storeGHConfig(cfg); setGhConfigState(cfg); }, []);

  const doPublish = useCallback(async (data: CMSData): Promise<boolean> => {
    if (!ghConfig) { toast.error("Configure o GitHub primeiro."); return false; }
    if (!ghConfig.token) { toast.error("Token não informado."); return false; }
    const STEPS: PublishStep[] = [
      { id: "validate", label: "Validando dados...", status: "pending" },
      { id: "branch", label: `Garantindo branch '${CMS_BRANCH}' isolado...`, status: "pending" },
      { id: "commit", label: `Salvando em '${CMS_BRANCH}/data.json'...`, status: "pending" },
      { id: "pubcfg", label: "Gravando cms-config.json (sincronização multi-dispositivo)...", status: "pending" },
      { id: "push", label: "Confirmando gravação...", status: "pending" },
      { id: "vercel", label: "Vercel recebendo sinal de deploy...", status: "pending" },
      { id: "done", label: "Conteúdo salvo — seguro de atualizações do Figma.", status: "pending" },
    ];
    setPublishSteps(STEPS); setPublishOpen(true);
    setSaveStatus("saving"); setSaveError(""); addLog("info", `Publicação iniciada → branch '${CMS_BRANCH}' (isolado do código).`);
    const upd = (id: string, status: PublishStep["status"], error?: string) =>
      setPublishSteps(prev => prev.map(s => s.id === id ? { ...s, status, error } : s));
    upd("validate", "running"); await new Promise(r => setTimeout(r, 200)); upd("validate", "done");
    upd("branch", "running");
    const branchOk = await ghEnsureCMSBranch(ghConfig);
    upd("branch", branchOk ? "done" : "error", branchOk ? undefined : "Falha ao criar/verificar branch cms-data.");
    if (!branchOk) {
      setSaveStatus("error"); setSaveError("Falha ao garantir branch cms-data.");
      toast.error("Falha ao criar branch cms-data. Verifique permissões do token.");
      addLog("error", "Branch cms-data não pôde ser criado/verificado.");
      return false;
    }
    upd("commit", "running");
    const payload = { ...data, updatedAt: new Date().toISOString() };
    const result = await ghCommitCMS(ghConfig, payload);
    if (!result.ok) {
      upd("commit", "error", result.error); upd("push", "error");
      setSaveStatus("error"); setSaveError(result.error ?? "Falha ao commitar.");
      toast.error(`Commit falhou: ${result.error}`);
      addLog("error", `Commit falhou: ${result.error}`);
      return false;
    }
    upd("commit", "done"); addLog("success", `✓ Salvo em branch '${CMS_BRANCH}' — Figma Make NUNCA toca este branch.`);
    upd("pubcfg", "running");
    try {
      const cfgContent = btoa(unescape(encodeURIComponent(JSON.stringify({ owner: ghConfig.owner, repo: ghConfig.repo, branch: CMS_BRANCH }, null, 2))));
      const cfgShaResp = await fetch(`https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${PUBLIC_CFG_PATH}?ref=${ghConfig.branch}`, { headers: GH_HEADERS(ghConfig.token) });
      const cfgShaData = cfgShaResp.ok ? await cfgShaResp.json() : {};
      const cfgBody: Record<string, unknown> = { message: "sync: cms-config.json [multi-device]", content: cfgContent, branch: ghConfig.branch };
      if (cfgShaData.sha) cfgBody.sha = cfgShaData.sha;
      const cfgR = await fetch(`https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${PUBLIC_CFG_PATH}`, { method: "PUT", headers: GH_HEADERS(ghConfig.token), body: JSON.stringify(cfgBody) });
      if (cfgR.ok) { upd("pubcfg", "done"); addLog("success", "✓ cms-config.json gravado — mobile e outros dispositivos sincronizarão automaticamente."); }
      else { upd("pubcfg", "error", "Falha ao gravar cms-config.json (não crítico)."); addLog("warn", "cms-config.json não gravado — sync multi-device pode falhar."); }
    } catch { upd("pubcfg", "error", "Erro de rede ao gravar cms-config.json."); }
    upd("push", "running"); await new Promise(r => setTimeout(r, 500)); upd("push", "done");
    upd("vercel", "running"); addLog("info", "Deploy iniciado na Vercel.");
    await new Promise(r => setTimeout(r, 1000)); upd("vercel", "done");
    upd("done", "running"); await new Promise(r => setTimeout(r, 200)); upd("done", "done");
    addLog("success", "Publicado — site ao vivo em ~1-2 min.");
    toast.success("Publicado! Vercel deploying em ~1-2 min.");
    setCms(payload); setSaveStatus("success");
    setTimeout(() => setSaveStatus("idle"), 8000);
    return true;
  }, [ghConfig, addLog]);

  const uploadFile = useCallback(async (
    file: File, type: "image" | "video" | "audio",
    onProgress: (p: UploadProgress) => void,
  ): Promise<string | null> => {
    const provider = getActiveStorageProvider(ghConfig);
    if (!provider.isConfigured()) { toast.error("Configure o GitHub + token antes de fazer uploads."); return null; }
    addLog("info", `Upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    try {
      const url = await provider.upload(file, type, onProgress);
      addLog("success", `Upload OK → ${url}`);
      toast.success(`Upload concluído: ${file.name}`);
      return url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro no upload.";
      setSaveError(msg); setSaveStatus("error");
      addLog("error", `Upload falhou: ${msg}`);
      toast.error(`Upload falhou: ${msg}`);
      onProgress({ phase: "error", percent: 0, bytesSent: 0, bytesTotal: file.size, speed: 0, eta: 0 });
      return null;
    }
  }, [ghConfig, addLog]);

  const deleteFile = useCallback(async (publicPath: string): Promise<void> => {
    const provider = getActiveStorageProvider(ghConfig);
    if (!provider.isConfigured()) return;
    try { await provider.remove(publicPath); addLog("info", `Removido: ${publicPath}`); } catch {}
  }, [ghConfig, addLog]);

  const syncFromGitHub = useCallback(async (): Promise<boolean> => {
    if (!ghConfig?.owner || !ghConfig?.repo) { toast.warning("Configure o GitHub para sincronizar."); return false; }
    addLog("info", `Sincronizando do branch '${CMS_BRANCH}'...`);
    const result = await ghFetchCMS(ghConfig);
    if (result) { setCms(result.data); addLog("success", `✓ Dados sincronizados do branch '${CMS_BRANCH}'.`); toast.success("Dados sincronizados!"); return true; }
    toast.error(`Branch '${CMS_BRANCH}' não encontrado. Publique algo primeiro.`); return false;
  }, [ghConfig, addLog]);

  // Salva silenciosamente no cms-data — sem abrir modal, sem interromper o admin
  const silentSave = useCallback(async (data: CMSData): Promise<void> => {
    if (!ghConfig?.token || !ghConfig?.owner || !ghConfig?.repo) return;
    try {
      await ghEnsureCMSBranch(ghConfig);
      const result = await ghCommitCMS(ghConfig, data);
      if (result.ok) {
        setSaveStatus("success");
        addLog("success", "Auto-save: conteudo persistido em cms-data.");
        toast.success("Salvo automaticamente", { duration: 1500 });
        setTimeout(() => setSaveStatus("idle"), 4000);
      } else {
        addLog("warn", `Auto-save falhou: ${result.error}`);
      }
    } catch { addLog("warn", "Auto-save: erro de rede."); }
  }, [ghConfig, addLog]);

  return {
    ghConfig, setGhConfig, clearGhConfig: useCallback(() => { clearGHConfig(); setGhConfigState(null); }, []),
    clearToken: useCallback(() => { clearGHTokenOnly(); setGhConfigState(prev => prev ? { ...prev, token: "" } : prev); }, []),
    cms, setCms, loading, saveStatus, saveError,
    logs, addLog, publishSteps, publishOpen, setPublishOpen,
    publish: doPublish, uploadFile, deleteFile, syncFromGitHub, silentSave,
  };
}
