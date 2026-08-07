/* GitHub-backed CMS storage: config persistence, content read/write, media upload/delete */
import type { GitHubConfig, CMSData, UploadProgress } from "./types";
import { makeCMSData } from "./defaults";
export const CMS_BRANCH = "cms-data";
export const CMS_FILE   = "data.json";
export const BKP_FILE   = "bkp.json";

export const GH_CFG_KEY      = "fp_gh_cfg";
export const GH_TOKEN_KEY    = "fp_gh_tok";
export const MAX_FILE_BYTES  = 25 * 1024 * 1024;
export const PUBLIC_CFG_PATH = "public/cms-config.json";
export function loadGHConfig(): GitHubConfig | null {
  try {
    const cfgStr = localStorage.getItem(GH_CFG_KEY);
    const token = sessionStorage.getItem(GH_TOKEN_KEY) ?? "";
    if (!cfgStr) return null;
    const { owner, repo, branch } = JSON.parse(cfgStr);
    if (!owner || !repo) return null;
    return { owner, repo, branch: branch || "main", token };
  } catch { return null; }
}
export function storeGHConfig(cfg: GitHubConfig) {
  try {
    localStorage.setItem(GH_CFG_KEY, JSON.stringify({ owner: cfg.owner, repo: cfg.repo, branch: cfg.branch }));
    if (cfg.token) sessionStorage.setItem(GH_TOKEN_KEY, cfg.token);
  } catch {}
}
export function clearGHConfig() {
  try { localStorage.removeItem(GH_CFG_KEY); sessionStorage.removeItem(GH_TOKEN_KEY); } catch {}
}
// Remove apenas o token (credencial sensível) mantendo owner/repo/branch —
// usado no logout para que o token nunca sobreviva ao fim da sessão admin.
export function clearGHTokenOnly() {
  try { sessionStorage.removeItem(GH_TOKEN_KEY); } catch {}
}

// Dispositivos sem localStorage descobrem o repo via /cms-config.json (gravado a cada publish)
export async function loadPublicConfig(): Promise<{ owner: string; repo: string; branch: string } | null> {
  try {
    const r = await fetch(`/cms-config.json?t=${Date.now()}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (d.owner && d.repo) return { owner: d.owner, repo: d.repo, branch: d.branch || "main" };
  } catch {}
  return null;
}
export const GH_API = (cfg: GitHubConfig, path: string) =>
  `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
export const GH_HEADERS = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
});

// SHA do arquivo no branch de CÓDIGO (uploads de mídia)
export async function ghGetSHA(cfg: GitHubConfig, path: string): Promise<string | undefined> {
  try {
    const r = await fetch(`${GH_API(cfg, path)}?ref=${cfg.branch}`, { headers: GH_HEADERS(cfg.token) });
    if (r.ok) return (await r.json()).sha;
  } catch {}
  return undefined;
}

// SHA de qualquer arquivo no branch cms-data
export async function ghGetCMSSHA(cfg: GitHubConfig, file = CMS_FILE): Promise<string | undefined> {
  try {
    const r = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${file}?ref=${CMS_BRANCH}`,
      { headers: GH_HEADERS(cfg.token) }
    );
    if (r.ok) return (await r.json()).sha;
  } catch {}
  return undefined;
}

// Grava qualquer JSON no branch cms-data — usado para data.json e bkp.json
export async function ghWriteCMSFile(cfg: GitHubConfig, file: string, data: CMSData, msg: string): Promise<boolean> {
  try {
    const sha = await ghGetCMSSHA(cfg, file);
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body: Record<string, unknown> = { message: msg, content, branch: CMS_BRANCH };
    if (sha) body.sha = sha;
    const r = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${file}`,
      { method: "PUT", headers: GH_HEADERS(cfg.token), body: JSON.stringify(body) }
    );
    return r.ok;
  } catch { return false; }
}

// Garante que o branch cms-data existe — cria a partir do branch de código se necessário
export async function ghEnsureCMSBranch(cfg: GitHubConfig): Promise<boolean> {
  try {
    // Verifica se branch já existe
    const check = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${CMS_BRANCH}`,
      { headers: GH_HEADERS(cfg.token) }
    );
    if (check.ok) return true;
    // Branch não existe — precisa do SHA do branch de código para criar
    const refR = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${cfg.branch}`,
      { headers: GH_HEADERS(cfg.token) }
    );
    if (!refR.ok) return false;
    const refData = await refR.json();
    const sha = refData.object?.sha;
    if (!sha) return false;
    // Cria o branch cms-data
    const createR = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/git/refs`,
      {
        method: "POST",
        headers: GH_HEADERS(cfg.token),
        body: JSON.stringify({ ref: `refs/heads/${CMS_BRANCH}`, sha }),
      }
    );
    return createR.ok;
  } catch { return false; }
}

export async function fileToBase64(file: File, onProgress: (p: UploadProgress) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    onProgress({ phase: "preparing", percent: 5, bytesSent: 0, bytesTotal: file.size, speed: 0, eta: 0 });
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress({ phase: "preparing", percent: Math.round((e.loaded / e.total) * 30) + 5, bytesSent: e.loaded, bytesTotal: file.size, speed: 0, eta: 0 });
      }
    };
    reader.onload = () => {
      resolve((reader.result as string).split(",")[1]);
      onProgress({ phase: "preparing", percent: 35, bytesSent: file.size, bytesTotal: file.size, speed: 0, eta: 0 });
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
export async function ghUploadBinary(
  cfg: GitHubConfig, folder: string, file: File,
  onProgress: (p: UploadProgress) => void,
): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${safe}`;
  const content = await fileToBase64(file, onProgress);
  onProgress({ phase: "sending", percent: 38, bytesSent: file.size * 0.38, bytesTotal: file.size, speed: 0, eta: 0 });
  const sha = await ghGetSHA(cfg, path);
  const body: Record<string, unknown> = { message: `Upload: ${file.name}`, content, branch: cfg.branch };
  if (sha) body.sha = sha;
  const startTime = Date.now();
  let simPct = 38;
  const ticker = setInterval(() => {
    simPct = Math.min(88, simPct + 5);
    const elapsed = (Date.now() - startTime) / 1000;
    const approxSent = (simPct / 100) * file.size;
    const speed = elapsed > 0 ? approxSent / elapsed : 0;
    const remaining = file.size - approxSent;
    const eta = speed > 0 ? remaining / speed : 0;
    onProgress({ phase: "sending", percent: simPct, bytesSent: approxSent, bytesTotal: file.size, speed, eta });
  }, 500);
  try {
    const r = await fetch(GH_API(cfg, path), { method: "PUT", headers: GH_HEADERS(cfg.token), body: JSON.stringify(body) });
    clearInterval(ticker);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      onProgress({ phase: "error", percent: simPct, bytesSent: 0, bytesTotal: file.size, speed: 0, eta: 0 });
      throw new Error((e as Record<string, string>).message || `HTTP ${r.status}`);
    }
    onProgress({ phase: "processing", percent: 95, bytesSent: file.size, bytesTotal: file.size, speed: 0, eta: 0 });
    await new Promise(r => setTimeout(r, 300));
    onProgress({ phase: "done", percent: 100, bytesSent: file.size, bytesTotal: file.size, speed: 0, eta: 0 });
    return `/${path.replace(/^public\//, "")}`;
  } catch (err) { clearInterval(ticker); throw err; }
}

// Lê do cms-data: tenta data.json, fallback automático para bkp.json
export async function ghFetchCMS(cfg: Pick<GitHubConfig, "owner" | "repo" | "token">): Promise<{ data: CMSData; sha: string; fromBackup?: boolean } | null> {
  const tryRead = async (file: string) => {
    try {
      const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
      if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
      const r = await fetch(
        `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${file}?ref=${CMS_BRANCH}`,
        { headers }
      );
      if (!r.ok) return null;
      const json = await r.json();
      const bytes = Uint8Array.from(atob(json.content.replace(/\n/g, "")), c => c.charCodeAt(0));
      return { parsed: JSON.parse(new TextDecoder().decode(bytes)), sha: json.sha as string };
    } catch { return null; }
  };
  const main = await tryRead(CMS_FILE);
  if (main) {
    const hasAdminData = main.parsed.theme || main.parsed.audios?.length || main.parsed.projects?.length;
    if (hasAdminData) return { data: makeCMSData(main.parsed), sha: main.sha };
  }
  const bkp = await tryRead(BKP_FILE);
  if (bkp) return { data: makeCMSData(bkp.parsed), sha: bkp.sha, fromBackup: true };
  if (main) return { data: makeCMSData(main.parsed), sha: main.sha };
  return null;
}

// Salva no cms-data: grava data.json (ativo) + bkp.json (backup permanente)
export async function ghCommitCMS(cfg: GitHubConfig, data: CMSData): Promise<{ ok: boolean; error?: string }> {
  try {
    await ghEnsureCMSBranch(cfg);
    const ok = await ghWriteCMSFile(cfg, CMS_FILE, data, "CMS: dados admin [cms-data]");
    if (!ok) return { ok: false, error: "Falha ao gravar data.json" };
    ghWriteCMSFile(cfg, BKP_FILE, data, "BKP: backup admin [cms-data]").catch(() => {});
    return { ok: true };
  } catch (e: unknown) { return { ok: false, error: e instanceof Error ? e.message : "Erro de rede." }; }
}
// Deleta arquivo de mídia do branch de CÓDIGO (uploads em public/uploads/)
export async function ghDeleteFile(cfg: GitHubConfig, publicPath: string): Promise<void> {
  const repoPath = `public${publicPath}`;
  const sha = await ghGetSHA(cfg, repoPath);
  if (!sha) return;
  await fetch(GH_API(cfg, repoPath), {
    method: "DELETE",
    headers: GH_HEADERS(cfg.token),
    body: JSON.stringify({ message: `Remove mídia: ${publicPath}`, sha, branch: cfg.branch }),
  });
}

export async function ghTestConnection(cfg: GitHubConfig): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, { headers: GH_HEADERS(cfg.token) });
    if (r.ok) { const d = await r.json(); return { ok: true, name: d.full_name }; }
    const e = await r.json().catch(() => ({}));
    return { ok: false, error: (e as Record<string, string>).message || `HTTP ${r.status}` };
  } catch (e: unknown) { return { ok: false, error: e instanceof Error ? e.message : "Erro de rede." }; }
}
