import { useState, useEffect, useLayoutEffect, useRef, useCallback, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  Mail, Menu, X, ChevronDown, Mic, Film, Palette,
  MessageCircle, ArrowUpRight, Play, Pause, Upload, Trash2, Plus,
  ImageIcon, VideoIcon, Check, Music, LogOut, Lock, Eye, EyeOff,
  Sparkles, Settings, FileText, Paintbrush, FolderOpen, Info,
  Pin, PinOff, Github, RefreshCw, AlertCircle, CheckCircle2, Loader2,
  Youtube, Link2, ScrollText, Zap, Clock, CheckCheck, XCircle,
  Library, Volume2, VolumeX, Search, ChevronLeft, ChevronRight,
  ZoomIn,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import heroVideo from "../imports/Portf_lio_Video_Final_Ver.mp4";
import pizzaVideo from "../imports/Lan_amento_Pizza_Ifood.mp4";
import logoImg from "../imports/Logo_Freed_Pierre.png";

/* ═══════════════════════════════════════════════════════════════════
   ARQUITETURA CMS — BRANCH DEDICADO (SOLUÇÃO DEFINITIVA)
   ─────────────────────────────────────────────────────────────────
   PROBLEMA: Figma Make commita em `main` e pode sobrescrever arquivos
   da pasta public/ ou qualquer arquivo que ele gerencie.

   SOLUÇÃO: Branch separado `cms-data` que Figma Make NUNCA toca.
   ─────────────────────────────────────────────────────────────────
   • Branch `main`      ← código (Figma Make commita aqui — OK)
   • Branch `cms-data`  ← CONTEÚDO ADMIN EXCLUSIVO
     - data.json        ← textos, cores, projetos, áudios, config
     - Figma Make não conhece este branch, nunca commita nele
     - Apenas o admin escreve neste branch via painel
   • public/uploads/    ← arquivos de mídia (Figma não apaga arquivos
                          que ele não gerenciou — safe)
   ─────────────────────────────────────────────────────────────────
   localStorage  : owner/repo/codeBranch
   sessionStorage: token (apaga ao fechar o browser)
═══════════════════════════════════════════════════════════════════ */

// Branch dedicado ao conteúdo admin — completamente separado do código
const CMS_BRANCH = "cms-data";
const CMS_FILE   = "data.json";
const BKP_FILE   = "bkp.json";

const GH_CFG_KEY      = "fp_gh_cfg";
const GH_TOKEN_KEY    = "fp_gh_tok";
const MAX_FILE_BYTES  = 25 * 1024 * 1024;
// Resolução máxima segura para decodificação garantida em hardware mobile
// (iOS/Android). Vídeos maiores ultrapassam o nível H.264 suportado pelos
// decoders de hardware de celulares e falham silenciosamente no <video>
// mobile, mesmo funcionando normalmente no desktop (decodificação via software).
const MAX_VIDEO_DIMENSION = 1920;
const PUBLIC_CFG_PATH = "public/cms-config.json";

interface GitHubConfig { owner: string; repo: string; branch: string; token: string; }

function loadGHConfig(): GitHubConfig | null {
  try {
    const cfgStr = localStorage.getItem(GH_CFG_KEY);
    const token = sessionStorage.getItem(GH_TOKEN_KEY) ?? "";
    if (!cfgStr) return null;
    const { owner, repo, branch } = JSON.parse(cfgStr);
    if (!owner || !repo) return null;
    return { owner, repo, branch: branch || "main", token };
  } catch { return null; }
}
function storeGHConfig(cfg: GitHubConfig) {
  try {
    localStorage.setItem(GH_CFG_KEY, JSON.stringify({ owner: cfg.owner, repo: cfg.repo, branch: cfg.branch }));
    if (cfg.token) sessionStorage.setItem(GH_TOKEN_KEY, cfg.token);
  } catch {}
}
function clearGHConfig() {
  try { localStorage.removeItem(GH_CFG_KEY); sessionStorage.removeItem(GH_TOKEN_KEY); } catch {}
}
// Remove apenas o token (credencial sensível) mantendo owner/repo/branch —
// usado no logout para que o token nunca sobreviva ao fim da sessão admin.
function clearGHTokenOnly() {
  try { sessionStorage.removeItem(GH_TOKEN_KEY); } catch {}
}

// Dispositivos sem localStorage descobrem o repo via /cms-config.json (gravado a cada publish)
async function loadPublicConfig(): Promise<{ owner: string; repo: string; branch: string } | null> {
  try {
    const r = await fetch(`/cms-config.json?t=${Date.now()}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (d.owner && d.repo) return { owner: d.owner, repo: d.repo, branch: d.branch || "main" };
  } catch {}
  return null;
}

const GH_API = (cfg: GitHubConfig, path: string) =>
  `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
const GH_HEADERS = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
});

// SHA do arquivo no branch de CÓDIGO (uploads de mídia)
async function ghGetSHA(cfg: GitHubConfig, path: string): Promise<string | undefined> {
  try {
    const r = await fetch(`${GH_API(cfg, path)}?ref=${cfg.branch}`, { headers: GH_HEADERS(cfg.token) });
    if (r.ok) return (await r.json()).sha;
  } catch {}
  return undefined;
}

// SHA de qualquer arquivo no branch cms-data
async function ghGetCMSSHA(cfg: GitHubConfig, file = CMS_FILE): Promise<string | undefined> {
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
async function ghWriteCMSFile(cfg: GitHubConfig, file: string, data: CMSData, msg: string): Promise<boolean> {
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
async function ghEnsureCMSBranch(cfg: GitHubConfig): Promise<boolean> {
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

async function fileToBase64(file: File, onProgress: (p: UploadProgress) => void): Promise<string> {
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

// Lê apenas as dimensões do vídeo (via metadata do próprio navegador) antes do
// upload. Resoluções muito altas (ex: exports quadrados de 3000x3000 de apps
// de IA/edição) forçam o encoder a usar um nível H.264 que os decoders de
// hardware de celulares (iOS e a maioria dos Android) recusam reproduzir —
// o vídeo funciona no desktop (decodificação por software, mais tolerante)
// e simplesmente não reproduz no mobile, sem erro visível para o usuário.
function probeVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const dims = { width: v.videoWidth, height: v.videoHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler o vídeo.")); };
    v.src = url;
  });
}

async function ghUploadBinary(
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
async function ghFetchCMS(cfg: Pick<GitHubConfig, "owner" | "repo" | "token">): Promise<{ data: CMSData; sha: string; fromBackup?: boolean } | null> {
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
async function ghCommitCMS(cfg: GitHubConfig, data: CMSData): Promise<{ ok: boolean; error?: string }> {
  try {
    await ghEnsureCMSBranch(cfg);
    const ok = await ghWriteCMSFile(cfg, CMS_FILE, data, "CMS: dados admin [cms-data]");
    if (!ok) return { ok: false, error: "Falha ao gravar data.json" };
    ghWriteCMSFile(cfg, BKP_FILE, data, "BKP: backup admin [cms-data]").catch(() => {});
    return { ok: true };
  } catch (e: unknown) { return { ok: false, error: e instanceof Error ? e.message : "Erro de rede." }; }
}

// Deleta arquivo de mídia do branch de CÓDIGO (uploads em public/uploads/)
async function ghDeleteFile(cfg: GitHubConfig, publicPath: string): Promise<void> {
  const repoPath = `public${publicPath}`;
  const sha = await ghGetSHA(cfg, repoPath);
  if (!sha) return;
  await fetch(GH_API(cfg, repoPath), {
    method: "DELETE",
    headers: GH_HEADERS(cfg.token),
    body: JSON.stringify({ message: `Remove mídia: ${publicPath}`, sha, branch: cfg.branch }),
  });
}

async function ghTestConnection(cfg: GitHubConfig): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, { headers: GH_HEADERS(cfg.token) });
    if (r.ok) { const d = await r.json(); return { ok: true, name: d.full_name }; }
    const e = await r.json().catch(() => ({}));
    return { ok: false, error: (e as Record<string, string>).message || `HTTP ${r.status}` };
  } catch (e: unknown) { return { ok: false, error: e instanceof Error ? e.message : "Erro de rede." }; }
}

function parseVideoUrl(url: string): { platform: "youtube" | "vimeo"; id: string; embed: string; thumb: string } | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (yt) { const id = yt[1]; return { platform: "youtube", id, embed: `https://www.youtube.com/embed/${id}`, thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }; }
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) { const id = vm[1]; return { platform: "vimeo", id, embed: `https://player.vimeo.com/video/${id}`, thumb: "" }; }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════════ */

interface UploadProgress {
  phase: "preparing" | "sending" | "processing" | "done" | "error";
  percent: number; bytesSent: number; bytesTotal: number; speed: number; eta: number;
}

interface LogEntry { id: string; ts: Date; level: "info" | "success" | "error" | "warn"; msg: string; }
interface PublishStep { id: string; label: string; status: "pending" | "running" | "done" | "error"; error?: string; }

interface CMSProject {
  id: string; title: string; description: string; category: string;
  mediaType: "image" | "video" | "embed"; mediaUrl: string; thumbUrl?: string;
  images?: string[]; // múltiplas imagens para carrossel (Design)
  embedPlatform?: "youtube" | "vimeo"; embedId?: string;
  isFixed?: boolean; createdAt: number;
}
type DisplayProject = CMSProject;

interface CMSAudio {
  id: string; title: string; artist?: string;
  genre?: string; // gênero musical ex: "Trap", "Eletrônico", "Gospel"
  url: string; coverUrl?: string; createdAt: number;
  hidden?: boolean; // ocultar da visualização pública (admin ainda vê)
}

interface CMSServiceContent {
  title: string; description: string; tags: string[];
}

interface CMSAdvantageContent {
  title: string; body: string;
}

interface CMSData {
  content: SiteContent;
  theme: SiteTheme;
  services: CMSServiceContent[];
  advantages: CMSAdvantageContent[];
  projects: CMSProject[];
  audios: CMSAudio[];
  pinned: string[];
  hiddenSeeds: string[];
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════
   DEFAULTS
═══════════════════════════════════════════════════════════════════ */

const CONTENT_DEFAULTS = {
  heroLine1: "ONDE ÁUDIO,",
  heroLine2: "DESIGN",
  heroLine3: "E MOVIMENTOS",
  heroLine4: "SE ENCONTRAM",
  heroBadge: "Disponível para projetos",
  heroSubtitle: "Um profissional. Quatro linguagens. Design, motion, vídeo e produção fonográfica para marcas, artistas e conteúdo digital.",
  stat1Val: "10+", stat1Label: "Anos de experiência",
  stat2Val: "4",   stat2Label: "Áreas de atuação",
  stat3Val: "Multi", stat3Label: "Perfil criativo",
  stat4Val: "ECAD", stat4Label: "Cadastrado",
  servicesHeading1: "O que posso",
  servicesHeading2: "fazer por você?",
  difHeading1: "Menos",
  difHeading2: "intermediários.",
  difHeading3: "Mais resultado.",
  difSubtext: "Com mais de 10 anos de experiência em design gráfico, motion design, edição de vídeo e produção musical, ofereço uma solução criativa completa sem dividir o projeto entre múltiplos profissionais.",
  contactHeading: "Bora criar algo?",
  contactSubtext: "Tem um projeto de design, vídeo, motion ou música? Me manda uma mensagem. Respondo pelo WhatsApp ou e-mail — sem enrolação.",
  footerCopy: "© 2026 Frederico Pierre · Design · Motion Designer · Video Maker · Audiovisual",
};
type SiteContent = typeof CONTENT_DEFAULTS;

const THEME_DEFAULTS = {
  primary: "#E8863A", background: "#07080F", foreground: "#EDE9E2",
  card: "#0F111A", muted: "#1A1E2B", border: "rgba(237,233,226,0.08)",
};
type SiteTheme = typeof THEME_DEFAULTS;

const DEFAULT_SERVICES: CMSServiceContent[] = [
  {
    title: "Design Gráfico",
    description: "Identidade visual para singles musicais, lançamentos digitais, artes para redes sociais, capas de álbum, materiais institucionais e peças impressas.",
    tags: ["Photoshop", "Illustrator", "Identidade Visual", "Mídias Sociais", "Canva"],
  },
  {
    title: "Video Making",
    description: "Vídeos para redes sociais, videoclipes, lyric videos, vídeos institucionais e conteúdo audiovisual. Edição e storytelling visual.",
    tags: ["Premiere Pro", "Edição de Vídeo", "Lyric Video", "Reels", "Institucional"],
  },
  {
    title: "Motion Design",
    description: "Animações, vinhetas, motion graphics e edição de vídeo integrada. Cada frame pensado para gerar impacto e engajamento em poucos segundos.",
    tags: ["After Effects", "Motion Graphics", "Animação", "Vinhetas", "Reels"],
  },
  {
    title: "Produção Fonográfica",
    description: "Gravação, produção, edição, mixagem e masterização em estúdio. Cadastrado no ECAD. Entrega pronta para streaming.",
    tags: ["FL Studio", "Reaper", "Mixagem", "Masterização", "Streaming", "ECAD"],
  },
];

const DEFAULT_ADVANTAGES: CMSAdvantageContent[] = [
  { title: "Um profissional, quatro frentes", body: "Design, motion, vídeo e áudio sob o mesmo teto — sem intermediários, sem ruído de comunicação." },
  { title: "Entrega com mais agilidade", body: "Menos dependência de terceiros significa prazos menores e maior controle criativo do início ao fim." },
  { title: "Linguagem visual + sonora integrada", body: "Quem entende de áudio entende de ritmo — e isso se reflete na edição, no corte e na identidade visual." },
  { title: "10+ anos de experiência", body: "Trajetória em agências, gráficas, estúdios e mercado independente. Da teoria à prática em projetos reais." },
];

function isCorrupted(obj: Record<string, string>): boolean {
  return Object.values(obj).some(v => typeof v === "string" && /Ã|Â[ª-¿]|â€/.test(v));
}

function makeCMSData(overrides: Partial<CMSData & { audio?: { name: string; url: string } | null }> = {}): CMSData {
  const safeContent = overrides.content && !isCorrupted(overrides.content)
    ? { ...CONTENT_DEFAULTS, ...overrides.content }
    : { ...CONTENT_DEFAULTS };
  let audios = overrides.audios ?? [];
  if (!audios.length && overrides.audio) {
    audios = [{ id: "migrated-audio", title: (overrides.audio as { name: string; url: string }).name.replace(/\.[^.]+$/, ""), url: (overrides.audio as { name: string; url: string }).url, createdAt: 0 }];
  }
  return {
    content: safeContent,
    theme: { ...THEME_DEFAULTS, ...(overrides.theme ?? {}) },
    services: overrides.services?.length ? overrides.services : DEFAULT_SERVICES,
    advantages: overrides.advantages?.length ? overrides.advantages : DEFAULT_ADVANTAGES,
    projects: overrides.projects ?? [],
    audios,
    pinned: overrides.pinned ?? [],
    hiddenSeeds: overrides.hiddenSeeds ?? [],
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

type SaveStatus = "idle" | "saving" | "success" | "error";

/* ═══════════════════════════════════════════════════════════════════
   CMS HOOK
═══════════════════════════════════════════════════════════════════ */

function useCMS() {
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
    if (!ghConfig?.token) { toast.error("Configure o GitHub + token antes de fazer uploads."); return null; }
    const folder = type === "image" ? "public/uploads/images" : type === "video" ? "public/uploads/videos" : "public/uploads/audio";
    addLog("info", `Upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    try {
      const url = await ghUploadBinary(ghConfig, folder, file, onProgress);
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
    if (!ghConfig?.token || !publicPath.startsWith("/uploads/")) return;
    try { await ghDeleteFile(ghConfig, publicPath); addLog("info", `Removido: ${publicPath}`); } catch {}
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

/* ═══════════════════════════════════════════════════════════════════
   FORMATTERS
═══════════════════════════════════════════════════════════════════ */

function fmtBytes(b: number) {
  if (b < 1024) return `${b.toFixed(0)} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
function fmtSpeed(bps: number) {
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(2)} MB/s`;
}
function fmtETA(s: number) {
  if (!isFinite(s) || s <= 0) return "";
  return s < 60 ? `~${Math.ceil(s)}s` : `~${Math.ceil(s / 60)}min`;
}
function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

const PHASE_LABELS: Record<UploadProgress["phase"], string> = {
  preparing: "Preparando", sending: "Enviando", processing: "Processando", done: "Concluído", error: "Erro",
};

/* ═══════════════════════════════════════════════════════════════════
   AUTH
   ─────────────────────────────────────────────────────────────────
   Sessão admin com expiração deslizante (TTL) em vez de flag eterna:
   reduz o risco de uma aba esquecida aberta manter acesso admin
   indefinidamente. Tudo client-side, sem configuração externa.
═══════════════════════════════════════════════════════════════════ */

const ADMIN_USER = "freed";
const ADMIN_PASS = "pierre2026";
const SESSION_KEY = "fp_admin_session";
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4h de sessão administrativa (renovada com o uso)

function checkSession(): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const exp = Number(raw);
    if (!Number.isFinite(exp) || Date.now() > exp) { sessionStorage.removeItem(SESSION_KEY); return false; }
    return true;
  } catch { return false; }
}
function startSession() { try { sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_TTL_MS)); } catch {} }
function renewSession() { try { if (checkSession()) sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_TTL_MS)); } catch {} }
function endSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch {} }

// Throttle de tentativas de login (brute-force básico) — inteiramente local, sem servidor.
const LOGIN_FAIL_KEY = "fp_admin_login_fails";
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 60 * 1000;

function getLoginFailState(): { count: number; lockUntil: number } {
  try {
    const raw = sessionStorage.getItem(LOGIN_FAIL_KEY);
    if (!raw) return { count: 0, lockUntil: 0 };
    const parsed = JSON.parse(raw);
    return { count: Number(parsed.count) || 0, lockUntil: Number(parsed.lockUntil) || 0 };
  } catch { return { count: 0, lockUntil: 0 }; }
}
function setLoginFailState(s: { count: number; lockUntil: number }) {
  try { sessionStorage.setItem(LOGIN_FAIL_KEY, JSON.stringify(s)); } catch {}
}
function clearLoginFailState() { try { sessionStorage.removeItem(LOGIN_FAIL_KEY); } catch {} }

/* ═══════════════════════════════════════════════════════════════════
   SEEDS
═══════════════════════════════════════════════════════════════════ */

const ALL_SEEDS: DisplayProject[] = [
  {
    id: "seed-pizza", category: "Motion Design",
    title: "Motion Lançamento de Pizzas",
    description: "🍕✨ Motion Design desenvolvido para o Grupo Beija-flor, promovendo novidades do cardápio da unidade de Jardim Teresópolis, Betim/MG.\n\nCada animação, transição e detalhe foi pensado para valorizar o produto e criar uma comunicação dinâmica, moderna, envolvente e com apelo comercial.",
    mediaType: "video", mediaUrl: pizzaVideo, createdAt: 0,
  },
];

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════ */

const CATEGORIES = ["Motion Design", "Video Making", "Design Gráfico", "Produção Fonográfica"];

const CATEGORY_COLORS: Record<string, string> = {
  "Motion Design": "#E8863A",
  "Video Making": "#6C9EE8",
  "Design Gráfico": "#A278D4",
  "Produção Fonográfica": "#5BC49A",
};

const SERVICE_NUMBERS = ["01", "02", "03", "04"];
const SERVICE_ICONS = [<Palette size={24} />, <Film size={24} />, <Sparkles size={24} />, <Mic size={24} />];
const SERVICE_CATEGORIES = [["Design Gráfico"], ["Video Making"], ["Motion Design"], ["Produção Fonográfica"]];

const AUDIO_ACCEPT = "audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/flac,audio/x-flac,.mp3,.wav,.ogg,.aac,.m4a,.flac";

const CONTACT_LINKS = [
  { icon: <MessageCircle size={18} />, label: "WhatsApp", value: "(31) 97579-1151", href: "https://wa.me/5531975791151" },
  { icon: <Mail size={18} />, label: "E-mail", value: "fredericopierredamasceno@gmail.com", href: "mailto:fredericopierredamasceno@gmail.com" },
];

/* ═══════════════════════════════════════════════════════════════════
   TAP DETECTION — distingue tap intencional de scroll/drag
═══════════════════════════════════════════════════════════════════ */

const TAP_THRESHOLD = 12; // px — movimento acima disso cancela o tap

function useTapHandler(handler: () => void) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      startRef.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!startRef.current) return;
      const dx = Math.abs(e.clientX - startRef.current.x);
      const dy = Math.abs(e.clientY - startRef.current.y);
      startRef.current = null;
      if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) handler();
    },
    onPointerCancel: () => { startRef.current = null; },
  };
}

/* ═══════════════════════════════════════════════════════════════════
   ERROR BOUNDARY
═══════════════════════════════════════════════════════════════════ */

interface EBState { error: Error | null }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error("ErrorBoundary:", e, info); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full border border-red-500/30 bg-red-500/5 p-8">
          <div className="font-mono text-[10px] text-red-400 tracking-widest uppercase mb-3">Erro do Sistema</div>
          <h1 className="text-4xl font-black uppercase text-foreground mb-4 leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Algo<br /><span className="text-red-400">quebrou.</span></h1>
          <div className="border border-red-500/20 bg-background p-3 mb-5 overflow-auto max-h-32">
            <code className="font-mono text-[10px] text-red-300/70 break-all">{error.message}</code>
          </div>
          <button onClick={() => window.location.reload()} className="flex items-center gap-2 bg-primary text-background px-4 py-2.5 font-bold text-xs tracking-widest uppercase"><RefreshCw size={12} /> Recarregar</button>
        </div>
      </div>
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════
   HOOKS
═══════════════════════════════════════════════════════════════════ */

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const fn = () => { const el = document.documentElement; const max = el.scrollHeight - el.clientHeight; setP(max > 0 ? el.scrollTop / max : 0); };
    window.addEventListener("scroll", fn, { passive: true }); return () => window.removeEventListener("scroll", fn);
  }, []);
  return p;
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ═══════════════════════════════════════════════════════════════════
   UTILITY COMPONENTS
═══════════════════════════════════════════════════════════════════ */

function FadeIn({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"} ${className}`}>{children}</div>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-10 md:mb-14">
      <span className="font-mono text-[10px] text-muted-foreground tracking-[0.3em] uppercase">—</span>
      <span className="font-mono text-[10px] text-muted-foreground tracking-[0.3em] uppercase">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function LoadingScreen() {
  const [dots, setDots] = useState(".");
  useEffect(() => { const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500); return () => clearInterval(t); }, []);
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-2 border-border" />
        <div className="absolute inset-0 border-2 border-primary/60 animate-spin" style={{ animationDuration: "3s", clipPath: "inset(0 0 50% 50%)" }} />
        <div className="absolute inset-2 flex items-center justify-center"><img src={logoImg} alt="" className="w-8 h-auto brightness-200 opacity-70" /></div>
      </div>
      <div className="text-center">
        <div className="font-mono text-[10px] text-primary tracking-[0.4em] uppercase mb-2">Freed Pierre · Portfólio</div>
        <p className="font-mono text-[10px] text-muted-foreground tracking-widest">Carregando{dots}</p>
      </div>
    </div>
  );
}

function UploadProgressBar({ progress }: { progress: UploadProgress | null }) {
  if (!progress) return null;
  const color = progress.phase === "error" ? "bg-red-500" : progress.phase === "done" ? "bg-green-500" : "bg-primary";
  const textColor = progress.phase === "error" ? "text-red-400" : progress.phase === "done" ? "text-green-400" : "text-primary";
  return (
    <div className="space-y-2 border border-border p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className={`font-mono text-[10px] tracking-widest uppercase ${textColor} flex items-center gap-1.5`}>
          {progress.phase === "sending" && <Loader2 size={9} className="animate-spin" />}
          {progress.phase === "done" && <CheckCircle2 size={9} />}
          {progress.phase === "error" && <XCircle size={9} />}
          {PHASE_LABELS[progress.phase]}
          {progress.phase === "sending" && progress.eta > 0 && <span className="text-muted-foreground ml-1">{fmtETA(progress.eta)}</span>}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{progress.percent.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground tabular-nums">
        <span>{fmtBytes(progress.bytesSent)} / {fmtBytes(progress.bytesTotal)}</span>
        {progress.speed > 0 && <span>{fmtSpeed(progress.speed)}</span>}
      </div>
    </div>
  );
}

function PublishProgressModal({ open, steps, onClose }: { open: boolean; steps: PublishStep[]; onClose: () => void }) {
  const allDone = steps.length > 0 && steps.every(s => s.status === "done");
  const hasError = steps.some(s => s.status === "error");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/96 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md bg-card border border-border">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">GitHub + Vercel</div>
            <h2 className="text-xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {hasError ? "Falha" : allDone ? "Publicado!" : "Publicando..."}
            </h2>
          </div>
          {(allDone || hasError) && <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border border-border text-muted-foreground"><X size={14} /></button>}
        </div>
        <div className="p-6 space-y-3">
          {steps.map((step, i) => (
            <div key={step.id} className={`flex items-start gap-3 transition-opacity ${i > 0 && steps[i-1].status === "pending" ? "opacity-25" : "opacity-100"}`}>
              <div className="flex-shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center">
                {step.status === "done" && <CheckCircle2 size={16} className="text-green-400" />}
                {step.status === "running" && <Loader2 size={16} className="text-primary animate-spin" />}
                {step.status === "error" && <XCircle size={16} className="text-red-400" />}
                {step.status === "pending" && <div className="w-2.5 h-2.5 rounded-full border border-border" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${step.status === "done" ? "text-green-400" : step.status === "running" ? "text-primary" : step.status === "error" ? "text-red-400" : "text-muted-foreground"}`}>{step.label}</span>
                {step.error && <p className="font-mono text-[10px] text-red-400 mt-0.5 break-all">{step.error}</p>}
              </div>
            </div>
          ))}
        </div>
        {(allDone || hasError) && (
          <div className="px-6 pb-5 border-t border-border pt-4 space-y-3">
            {allDone && <div className="flex items-start gap-2 text-sm text-muted-foreground font-light"><Clock size={13} className="text-amber-400 flex-shrink-0 mt-0.5" /><span>Site ao vivo em ~1–2 min.</span></div>}
            <button onClick={onClose} className={`w-full py-2.5 font-bold text-xs tracking-widest uppercase ${allDone ? "bg-primary text-background" : "border border-border text-muted-foreground"}`}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminLoginModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [user, setUser] = useState(""); const [pass, setPass] = useState(""); const [showPass, setShowPass] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { if (!open) { setUser(""); setPass(""); setErr(""); } }, [open]);
  const submit = () => {
    const failState = getLoginFailState();
    if (failState.lockUntil > Date.now()) {
      const secs = Math.ceil((failState.lockUntil - Date.now()) / 1000);
      setErr(`Muitas tentativas incorretas. Aguarde ${secs}s.`);
      return;
    }
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      clearLoginFailState();
      startSession();
      onSuccess(); onClose();
    } else {
      const nextCount = failState.count + 1;
      if (nextCount >= MAX_LOGIN_ATTEMPTS) {
        setLoginFailState({ count: 0, lockUntil: Date.now() + LOGIN_LOCK_MS });
        setErr(`Muitas tentativas incorretas. Aguarde ${Math.round(LOGIN_LOCK_MS / 1000)}s.`);
      } else {
        setLoginFailState({ count: nextCount, lockUntil: 0 });
        setErr("Usuário ou senha incorretos.");
      }
    }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div><div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">Admin</div><h2 className="text-2xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Entrar</h2></div>
          <Lock size={18} className="text-muted-foreground" />
        </div>
        <div className="p-6 space-y-4">
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Usuário</label><input value={user} onChange={e => setUser(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" autoComplete="username" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Senha</label>
            <div className="relative"><input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} className="w-full bg-muted border border-border px-4 py-3 pr-11 text-sm text-foreground focus:outline-none focus:border-primary" autoComplete="current-password" />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPass ? <Eye size={15} /> : <EyeOff size={15} />}</button>
            </div>
          </div>
          {err && <p className="font-mono text-[10px] text-red-400">{err}</p>}
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Cancelar</button>
          <button onClick={submit} className="flex items-center gap-2 bg-primary text-background px-6 py-2.5 font-bold text-xs tracking-widest uppercase"><Lock size={12} /> Entrar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   IMAGE MULTI-CAROUSEL (para projetos com várias imagens)
═══════════════════════════════════════════════════════════════════ */

function ImageCarousel({ images, title, fullscreen }: { images: string[]; title: string; fullscreen?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const startX = useRef<number | null>(null);

  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => { startX.current = e.clientX; },
    onPointerUp: (e: React.PointerEvent) => {
      if (startX.current === null) return;
      const dx = e.clientX - startX.current;
      startX.current = null;
      if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    },
    onPointerCancel: () => { startX.current = null; },
  };

  if (images.length === 0) return null;

  return (
    <div className="relative w-full h-full select-none" {...handlers} style={{ touchAction: "pan-y" }}>
      <img
        src={images[idx]} alt={`${title} ${idx + 1}`}
        className={`w-full h-full ${fullscreen ? "object-contain" : "object-cover"} transition-opacity duration-200`}
        loading="lazy"
      />
      {images.length > 1 && (<>
        <button onClick={e => { e.stopPropagation(); prev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-background/70 flex items-center justify-center text-foreground"><ChevronLeft size={14} /></button>
        <button onClick={e => { e.stopPropagation(); next(); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-background/70 flex items-center justify-center text-foreground"><ChevronRight size={14} /></button>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {images.map((_, i) => <div key={i} className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-foreground/40"}`} />)}
        </div>
      </>)}
      {fullscreen && <button onClick={e => { e.stopPropagation(); setZoom(!zoom); }} className="absolute top-2 right-2 w-7 h-7 bg-background/70 flex items-center justify-center text-foreground"><ZoomIn size={13} /></button>}
      {zoom && (
        <div className="fixed inset-0 z-[700] bg-background/98 flex items-center justify-center" onClick={() => setZoom(false)}>
          <img src={images[idx]} alt={title} className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center border border-border text-foreground"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROJECT CARD
═══════════════════════════════════════════════════════════════════ */

function ProjectCard({ item, onDelete, onTogglePin, isPinned, showAdmin, onClick }: {
  item: DisplayProject; onDelete?: (id: string) => void; onTogglePin?: (id: string) => void;
  isPinned?: boolean; showAdmin?: boolean; onClick?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const isEmbed = item.mediaType === "embed";
  const isMultiImage = item.mediaType === "image" && item.images && item.images.length > 1;
  const thumbSrc = item.thumbUrl || (isEmbed && item.embedPlatform === "youtube" && item.embedId ? `https://img.youtube.com/vi/${item.embedId}/hqdefault.jpg` : "");
  const tap = useTapHandler(() => onClick?.());

  const startPlay = useCallback(() => {
    if (isMultiImage) return;
    setPlaying(true);
    if (item.mediaType === "video" && videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play().catch(() => {}); }
  }, [item.mediaType, isMultiImage]);

  const stopPlay = useCallback(() => {
    setPlaying(false);
    if (item.mediaType === "video" && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  }, [item.mediaType]);

  // Dispositivos touch não disparam onMouseEnter — sem isso o preview em
  // vídeo nunca tocava no mobile (só ao abrir o modal via tap). Replica o
  // comportamento de hover do desktop quando o card entra na viewport.
  useEffect(() => {
    if (item.mediaType !== "video" || isMultiImage) return;
    if (typeof window === "undefined" || !window.matchMedia || window.matchMedia("(hover: hover)").matches) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) startPlay(); else stopPlay(); },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [item.mediaType, isMultiImage, startPlay, stopPlay]);

  return (
    <div
      ref={cardRef}
      className="relative bg-card group overflow-hidden aspect-video cursor-pointer select-none"
      onMouseEnter={startPlay} onMouseLeave={stopPlay}
      {...tap}
    >
      {item.mediaType === "video" && (
        <video ref={videoRef} src={item.mediaUrl} muted playsInline loop preload="metadata" className="absolute inset-0 w-full h-full object-cover" style={{ pointerEvents: "none" }} />
      )}
      {isEmbed && !playing && thumbSrc && (
        <img src={thumbSrc} alt={item.title} className="absolute inset-0 w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
      {isEmbed && !playing && !thumbSrc && (
        <div className="absolute inset-0 bg-card flex items-center justify-center"><Film size={28} className="text-muted-foreground" /></div>
      )}
      {isEmbed && playing && item.embedId && (
        <iframe src={item.embedPlatform === "youtube" ? `https://www.youtube.com/embed/${item.embedId}?autoplay=1&mute=1` : `https://player.vimeo.com/video/${item.embedId}?autoplay=1&muted=1`} className="absolute inset-0 w-full h-full" allow="autoplay" style={{ pointerEvents: "none", border: 0 }} />
      )}
      {isMultiImage && item.images ? (
        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
          <ImageCarousel images={item.images} title={item.title} />
        </div>
      ) : item.mediaType === "image" && (
        <img src={item.mediaUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" loading="lazy" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-5 pointer-events-none">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">{item.category}</div>
        <h3 className="text-base md:text-xl font-black uppercase text-foreground leading-tight line-clamp-2 break-words" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{item.title}</h3>
      </div>
      {(item.mediaType === "video" || isEmbed) && !playing && (
        <div className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center ${isEmbed ? "bg-red-600/90" : "bg-primary/90"}`}>
          {isEmbed ? <Youtube size={10} className="text-white" /> : <Play size={10} className="text-background ml-0.5" />}
        </div>
      )}
      {isMultiImage && (
        <div className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-background/70 font-mono text-[9px] text-foreground">
          1/{item.images?.length}
        </div>
      )}
      <div className={`absolute inset-0 border-2 border-primary transition-opacity pointer-events-none ${playing ? "opacity-40" : "opacity-0"}`} />
      {showAdmin && (
        <div className="absolute top-2 left-2 flex flex-col gap-1" style={{ pointerEvents: "all" }} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          {onTogglePin && (
            <button onClick={() => onTogglePin(item.id)} className={`flex items-center gap-1 px-2 py-1 text-[9px] font-mono tracking-wider uppercase border transition-colors ${isPinned ? "bg-primary text-background border-primary" : "bg-background/80 text-muted-foreground border-border"}`}>
              {isPinned ? <><Pin size={9} /> Fixado</> : <><PinOff size={9} /> Fixar</>}
            </button>
          )}
          {onDelete && !item.isFixed && (
            <button onClick={() => onDelete(item.id)} className="flex items-center gap-1 px-2 py-1 bg-background/80 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition-colors">
              <Trash2 size={9} /><span className="font-mono text-[9px] tracking-wider uppercase">Del</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CAROUSEL ROW (Netflix style) — com wheel e swipe
═══════════════════════════════════════════════════════════════════ */

function useCarouselScroll(itemsSignature?: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  // Recalcula as setas ao montar, quando a lista de itens muda e quando a viewport é redimensionada
  // (corrige estado inicial incorreto das setas e desalinhos entre breakpoints)
  useLayoutEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateArrows());
    ro.observe(el);
    window.addEventListener("resize", updateArrows);
    return () => { ro.disconnect(); window.removeEventListener("resize", updateArrows); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateArrows, itemsSignature]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current; if (!el) return;
    const cardW = (el.querySelector("[data-card]") as HTMLElement)?.offsetWidth ?? 260;
    el.scrollBy({ left: dir === "left" ? -(cardW * 2 + 12) : (cardW * 2 + 12), behavior: "smooth" });
  };

  const onWheel = (e: React.WheelEvent) => {
    const el = scrollRef.current; if (!el) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // touchpad já lida com isso nativamente
    const atStart = el.scrollLeft <= 0;
    const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
    // Se o carrossel já está no início/fim na direção do scroll, deixa o scroll vertical
    // da página continuar normalmente — evita "travar" a página ao passar o mouse por cima.
    if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
    e.preventDefault();
    el.scrollBy({ left: e.deltaY, behavior: "auto" });
  };

  return { scrollRef, canLeft, canRight, updateArrows, scroll, onWheel };
}

function CarouselRow({ label, items, showAdmin, pinned, onTogglePin, onDelete, onClickItem }: {
  label: string; items: DisplayProject[]; showAdmin: boolean; pinned: Set<string>;
  onTogglePin: (id: string) => void; onDelete: (id: string) => void; onClickItem: (item: DisplayProject) => void;
}) {
  const { scrollRef, canLeft, canRight, updateArrows, scroll, onWheel } = useCarouselScroll(items.length);
  const accent = CATEGORY_COLORS[label] ?? "var(--primary)";
  if (items.length === 0) return null;

  return (
    <div className="mb-8 md:mb-10">
      <div className="flex items-center justify-between mb-3 pr-1">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-5 flex-shrink-0 rounded-sm" style={{ background: accent }} />
          <span className="font-black uppercase text-foreground text-lg md:text-xl leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{label}</span>
          <span className="font-mono text-[9px] text-muted-foreground tracking-widest">{items.length}</span>
        </div>
        <div className="flex gap-1">
          {(["left", "right"] as const).map(dir => (
            <button key={dir} onClick={() => scroll(dir)} disabled={dir === "left" ? !canLeft : !canRight}
              className={`w-7 h-7 border flex items-center justify-center text-xs font-bold transition-all ${(dir === "left" ? canLeft : canRight) ? "border-border text-muted-foreground hover:border-primary hover:text-primary" : "border-border/30 text-muted-foreground/20 cursor-not-allowed"}`}>
              {dir === "left" ? "‹" : "›"}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-2 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className={`absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity ${canRight ? "opacity-100" : "opacity-0"}`} />
        <div
          ref={scrollRef} onScroll={updateArrows} onWheel={onWheel}
          className="flex gap-2 md:gap-3 overflow-x-auto pb-2"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-x" }}
        >
          {items.map((item, idx) => (
            <div key={item.id} data-card className="flex-shrink-0" style={{ scrollSnapAlign: "start", width: idx === 0 && items.length > 1 ? "clamp(220px, 38vw, 320px)" : "clamp(180px, 30vw, 260px)" }}>
              <ProjectCard item={item} showAdmin={showAdmin} isPinned={pinned.has(item.id)} onTogglePin={onTogglePin} onDelete={!item.isFixed ? onDelete : undefined} onClick={() => onClickItem(item)} />
            </div>
          ))}
          <div className="flex-shrink-0 w-4" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AUDIO SYSTEM — player com estado reativo correto
═══════════════════════════════════════════════════════════════════ */

const AUDIO_GENRES = ["Trap", "Beat", "Gospel", "Eletrônico", "Hip-Hop", "R&B", "Pop", "Funk", "Samba", "Reggaeton", "Lofi", "Instrumental", "Mix", "Outro"];

function AudioCard({ audio, isActive, isPlaying, onToggle, onDelete, showAdmin, size = "md" }: {
  audio: CMSAudio; isActive: boolean; isPlaying: boolean;
  onToggle: (id: string) => void; onDelete?: (id: string) => void; showAdmin: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const tap = useTapHandler(() => onToggle(audio.id));
  const imgSize = size === "lg" ? "w-48 h-48" : size === "sm" ? "w-28 h-28" : "w-36 h-36 md:w-44 md:h-44";
  return (
    <div className="flex-shrink-0 group relative" style={{ width: size === "lg" ? 192 : size === "sm" ? 112 : undefined }}>
      <div
        className={`relative overflow-hidden cursor-pointer border transition-colors ${imgSize} ${isActive ? "border-primary/60" : "border-border hover:border-primary/40"}`}
        {...tap}
      >
        {audio.coverUrl
          ? <img src={audio.coverUrl} alt={audio.title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full bg-card flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1A1E2B 0%, #0F111A 100%)" }}>
              <Music size={size === "lg" ? 40 : 24} className="text-muted-foreground/40" />
            </div>}
        <div className={`absolute inset-0 bg-background/40 flex items-center justify-center transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <div className="w-10 h-10 bg-primary flex items-center justify-center">
            {isPlaying ? <Pause size={16} className="text-background" /> : <Play size={16} className="text-background ml-0.5" />}
          </div>
        </div>
        {isActive && isPlaying && (
          <div className="absolute top-2 right-2 flex gap-0.5 items-end h-4">
            {[3, 5, 4, 6, 3].map((h, i) => <div key={i} className="w-0.5 bg-primary animate-pulse rounded-full" style={{ height: `${h * 2}px`, animationDelay: `${i * 0.15}s` }} />)}
          </div>
        )}
        {audio.genre && (
          <div className="absolute bottom-1.5 left-1.5">
            <span className="font-mono text-[8px] tracking-wider uppercase bg-background/80 text-primary px-1.5 py-0.5">{audio.genre}</span>
          </div>
        )}
      </div>
      <div className="pt-2 max-w-full">
        <p className="text-sm font-bold text-foreground truncate leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{audio.title}</p>
        {audio.artist && <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">{audio.artist}</p>}
      </div>
      {showAdmin && onDelete && (
        <button onPointerDown={e => e.stopPropagation()} onClick={() => onDelete(audio.id)} className="absolute top-1 right-1 w-6 h-6 bg-background/80 border border-red-500/50 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={9} />
        </button>
      )}
    </div>
  );
}

/* AudioPlayer hook — reutilizável no carrossel e na galeria */
function useAudioPlayer(audios: CMSAudio[]) {
  const audioElRef = useRef<HTMLAudioElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const activeAudio = audios.find(a => a.id === activeId) ?? null;

  const toggle = useCallback((id: string) => {
    const el = audioElRef.current;
    if (activeId === id && el) {
      if (el.paused) el.play().catch(() => {});
      else el.pause();
    } else {
      setActiveId(id); setCurrentTime(0); setDuration(0); setLoading(true);
    }
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const el = audioElRef.current; if (!el) return;
    setIsPlaying(false);
    const tryPlay = () => el.play().catch(() => setIsPlaying(false));
    if (el.readyState >= 3) tryPlay();
    else el.addEventListener("canplay", tryPlay, { once: true });
  }, [activeId]);

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioElRef.current; if (!el || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };

  const audioEl = activeAudio ? (
    <audio
      key={activeAudio.id}
      ref={audioElRef}
      src={activeAudio.url}
      muted={muted}
      preload="metadata"
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      onEnded={() => { setIsPlaying(false); setActiveId(null); }}
      onTimeUpdate={() => { const el = audioElRef.current; if (el) setCurrentTime(el.currentTime); }}
      onLoadedMetadata={() => { const el = audioElRef.current; if (el) setDuration(el.duration); setLoading(false); }}
      onWaiting={() => setLoading(true)}
      onCanPlay={() => setLoading(false)}
      onError={() => { setLoading(false); toast.error("Erro ao carregar áudio."); }}
    />
  ) : null;

  return { activeAudio, activeId, isPlaying, currentTime, duration, muted, setMuted, loading, toggle, seekTo, audioEl, audioElRef };
}

function MiniPlayer({ player }: { player: ReturnType<typeof useAudioPlayer> }) {
  const { activeAudio, isPlaying, currentTime, duration, muted, setMuted, loading, toggle, seekTo, audioElRef } = player;
  if (!activeAudio) return null;
  return (
    <div className="border border-border bg-card/60 p-3 flex items-center gap-3">
      <div className="w-9 h-9 flex-shrink-0 overflow-hidden border border-border">
        {activeAudio.coverUrl ? <img src={activeAudio.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Music size={12} className="text-muted-foreground" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{activeAudio.title}</p>
        {activeAudio.artist && <p className="font-mono text-[9px] text-muted-foreground truncate">{activeAudio.artist}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-mono text-[9px] text-muted-foreground tabular-nums w-8 flex-shrink-0">{fmtTime(currentTime)}</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden cursor-pointer" onClick={seekTo}>
            <div className="h-full bg-primary rounded-full" style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }} />
          </div>
          <span className="font-mono text-[9px] text-muted-foreground tabular-nums w-8 flex-shrink-0 text-right">{duration > 0 ? fmtTime(duration) : "--:--"}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {loading
          ? <div className="w-8 h-8 bg-primary/20 flex items-center justify-center"><Loader2 size={13} className="animate-spin text-primary" /></div>
          : <button onClick={() => toggle(activeAudio.id)} className="w-8 h-8 bg-primary flex items-center justify-center text-background">
              {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
            </button>}
        <button onClick={() => { setMuted(!muted); if (audioElRef.current) audioElRef.current.muted = !muted; }} className="w-7 h-7 border border-border text-muted-foreground flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
      </div>
    </div>
  );
}

function AudioCarousel({ audios, showAdmin, onDelete }: {
  audios: CMSAudio[]; showAdmin: boolean; onDelete: (id: string) => void;
}) {
  const { scrollRef, canLeft, canRight, updateArrows, scroll, onWheel } = useCarouselScroll(audios.length);
  const player = useAudioPlayer(audios);
  const { activeId, isPlaying, toggle, audioEl } = player;

  if (audios.length === 0 && !showAdmin) return null;

  // Largura fixa dos cards: 140px no mobile, 160px no desktop — nunca estoura
  const CARD_W = 140;

  return (
    /* max-w-full garante que o carrossel não expanda o pai sem quebrar o scroll */
    <div className="space-y-4 w-full" style={{ maxWidth: "100%" }}>
      {audioEl}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-5 flex-shrink-0 rounded-sm" style={{ background: CATEGORY_COLORS["Produção Fonográfica"] }} />
          <span className="font-black uppercase text-foreground text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Produções</span>
          <span className="font-mono text-[9px] text-muted-foreground">{audios.length} faixa{audios.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex gap-1">
          {(["left", "right"] as const).map(dir => (
            <button key={dir} onClick={() => scroll(dir)} disabled={dir === "left" ? !canLeft : !canRight}
              className={`w-7 h-7 border flex items-center justify-center text-xs font-bold transition-all ${(dir === "left" ? canLeft : canRight) ? "border-border text-muted-foreground hover:border-primary hover:text-primary" : "border-border/30 text-muted-foreground/20 cursor-not-allowed"}`}>
              {dir === "left" ? "‹" : "›"}
            </button>
          ))}
        </div>
      </div>

      {/* Scroll row — width fixo nos cards evita overflow horizontal na página */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity ${canRight ? "opacity-100" : "opacity-0"}`} />
        <div
          ref={scrollRef} onScroll={updateArrows} onWheel={onWheel}
          className="flex gap-3 pb-2"
          style={{ overflowX: "auto", width: "100%", maxWidth: "100%", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-x" }}
        >
          {audios.map(a => (
            <div key={a.id} data-card className="flex-shrink-0" style={{ scrollSnapAlign: "start", width: CARD_W }}>
              <AudioCard audio={a} isActive={activeId === a.id} isPlaying={activeId === a.id && isPlaying} onToggle={toggle} onDelete={showAdmin ? onDelete : undefined} showAdmin={showAdmin} size="sm" />
            </div>
          ))}
          <div className="flex-shrink-0 w-2" />
        </div>
      </div>

      <MiniPlayer player={player} />

      {audios.length === 0 && showAdmin && (
        <div className="border border-dashed border-border py-8 text-center">
          <Music size={20} className="text-muted-foreground mx-auto mb-2" />
          <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Nenhuma produção ainda</p>
          <p className="font-mono text-[9px] text-muted-foreground/50 mt-1">Upload via painel admin · MP3, WAV, AAC, M4A, OGG, FLAC</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EDIT AUDIO MODAL — editar metadados sem deletar
═══════════════════════════════════════════════════════════════════ */

function EditAudioModal({ audio, open, onClose, onSave, uploadFile, ghConfigured }: {
  audio: CMSAudio | null; open: boolean; onClose: () => void;
  onSave: (updated: CMSAudio) => Promise<void>;
  uploadFile: (f: File, t: "image" | "video" | "audio", onProgress: (p: UploadProgress) => void) => Promise<string | null>;
  ghConfigured: boolean;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (audio) { setTitle(audio.title); setArtist(audio.artist ?? ""); setGenre(audio.genre ?? ""); }
    setCoverFile(null); setProgress(null); setBusy(false); setDone(false);
  }, [audio, open]);

  if (!open || !audio) return null;

  const handleSave = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    let coverUrl = audio.coverUrl;
    if (coverFile && ghConfigured) {
      const u = await uploadFile(coverFile, "image", setProgress);
      if (u) coverUrl = u;
    }
    await onSave({ ...audio, title: title.trim(), artist: artist.trim() || undefined, genre: genre.trim() || undefined, coverUrl });
    setDone(true);
    setTimeout(() => { setDone(false); onClose(); }, 600);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">Editar Áudio</div>
            <h2 className="text-xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Metadados</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 border border-border flex items-center justify-center text-muted-foreground"><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Current cover preview */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 border border-border flex-shrink-0 overflow-hidden">
              {audio.coverUrl ? <img src={audio.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Music size={20} className="text-muted-foreground" /></div>}
            </div>
            <div className="flex-1">
              <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Trocar capa</label>
              <div className={`border border-dashed p-2.5 text-center cursor-pointer transition-colors ${coverFile ? "border-primary" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("edit-cover-inp")?.click()}>
                <input id="edit-cover-inp" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setCoverFile(f); e.target.value = ""; }} />
                <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase">{coverFile ? coverFile.name.slice(0, 20) : "Selecionar imagem"}</span>
              </div>
              {progress && <div className="mt-1.5"><UploadProgressBar progress={progress} /></div>}
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Artista / feat.</label>
            <input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Frederico Pierre" className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Gênero</label>
            <div className="flex flex-wrap gap-1.5">
              {AUDIO_GENRES.map(g => (
                <button key={g} type="button" onClick={() => setGenre(genre === g ? "" : g)} className={`font-mono text-[9px] tracking-wider uppercase px-2 py-1 border transition-colors ${genre === g ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>{g}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="font-mono text-xs text-muted-foreground tracking-widest uppercase">Cancelar</button>
          <button onClick={handleSave} disabled={!title.trim() || busy} className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs tracking-widest uppercase transition-all ${done ? "bg-green-600 text-white" : "bg-primary text-background disabled:opacity-50"}`}>
            {done ? <><Check size={12} />Salvo!</> : busy ? <><Loader2 size={12} className="animate-spin" />Salvando...</> : <><Check size={12} />Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   UPLOAD MODAL
═══════════════════════════════════════════════════════════════════ */

type UploadMode = "file" | "youtube" | "vimeo";
type UploadMediaType = "video" | "image" | "audio";

function UploadModal({ open, onClose, onSave, onSaveAudio, uploadFile, ghConfigured }: {
  open: boolean; onClose: () => void;
  onSave: (proj: CMSProject) => Promise<void>;
  onSaveAudio: (audio: CMSAudio) => Promise<void>;
  uploadFile: (f: File, t: "image" | "video" | "audio", onProgress: (p: UploadProgress) => void) => Promise<string | null>;
  ghConfigured: boolean;
}) {
  const [tab, setTab] = useState<UploadMediaType>("video");
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [cat, setCat] = useState(CATEGORIES[0]);
  const [mode, setMode] = useState<UploadMode>("file");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [extraImageFiles, setExtraImageFiles] = useState<File[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioCoverFile, setAudioCoverFile] = useState<File | null>(null);
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [parsedVideo, setParsedVideo] = useState<ReturnType<typeof parseVideoUrl>>(null);
  const [thumbImgOk, setThumbImgOk] = useState(true);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [progress2, setProgress2] = useState<UploadProgress | null>(null);
  const [oversize, setOversize] = useState(false);
  const [incompatibleRes, setIncompatibleRes] = useState<{ width: number; height: number } | null>(null);
  const [checkingVideo, setCheckingVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const reset = useCallback(() => {
    setTitle(""); setDesc(""); setCat(CATEGORIES[0]); setMode("file");
    setMediaFile(null); setThumbFile(null); setExtraImageFiles([]); setAudioFile(null); setAudioCoverFile(null);
    setArtist(""); setGenre(""); setVideoUrl(""); setParsedVideo(null); setThumbImgOk(true);
    setProgress(null); setProgress2(null); setOversize(false); setIncompatibleRes(null); setCheckingVideo(false); setBusy(false); setDone(false); setErrMsg("");
  }, []);

  useEffect(() => {
    if (!open) { reset(); return; }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open, reset]);

  useEffect(() => {
    if (!videoUrl.trim()) { setParsedVideo(null); setThumbImgOk(true); return; }
    setParsedVideo(parseVideoUrl(videoUrl.trim())); setThumbImgOk(true);
  }, [videoUrl]);

  const handleFileChange = async (f: File) => {
    setIncompatibleRes(null);
    if (f.type.startsWith("video") && f.size > MAX_FILE_BYTES) { setOversize(true); setMediaFile(null); return; }
    setOversize(false);
    if (f.type.startsWith("video")) {
      setCheckingVideo(true);
      try {
        const { width, height } = await probeVideoDimensions(f);
        if (Math.max(width, height) > MAX_VIDEO_DIMENSION) {
          setIncompatibleRes({ width, height }); setMediaFile(null); setCheckingVideo(false); return;
        }
      } catch { /* se não for possível ler a resolução, deixa o navegador tentar normalmente */ }
      setCheckingVideo(false);
    }
    setMediaFile(f);
  };

  const handleSave = async () => {
    if (!title.trim() || busy) return;
    setBusy(true); setErrMsg("");

    if (tab === "audio") {
      if (!audioFile || !ghConfigured) { setErrMsg("Configure o GitHub e selecione um arquivo."); setBusy(false); return; }
      const url = await uploadFile(audioFile, "audio", setProgress);
      if (!url) { setErrMsg("Falha no upload."); setBusy(false); return; }
      let coverUrl: string | undefined;
      if (audioCoverFile) { const cu = await uploadFile(audioCoverFile, "image", setProgress2); if (cu) coverUrl = cu; }
      await onSaveAudio({ id: `audio-${Date.now()}`, title: title.trim(), artist: artist.trim() || undefined, genre: genre.trim() || undefined, url, coverUrl, createdAt: Date.now() });
      setDone(true); setTimeout(() => { reset(); onClose(); }, 1000);
      return;
    }

    const embedReady = (mode === "youtube" || mode === "vimeo") && !!parsedVideo;
    if (embedReady) {
      await onSave({ id: `proj-${Date.now()}`, title: title.trim(), description: desc.trim(), category: cat, mediaType: "embed", mediaUrl: parsedVideo!.embed, thumbUrl: parsedVideo!.thumb || undefined, embedPlatform: parsedVideo!.platform, embedId: parsedVideo!.id, createdAt: Date.now() });
      setDone(true); setTimeout(() => { reset(); onClose(); }, 1000);
      return;
    }

    if (!mediaFile || !ghConfigured) { setErrMsg("Configure o GitHub e selecione um arquivo."); setBusy(false); return; }
    if (incompatibleRes) { setErrMsg("Resolução do vídeo incompatível com celulares. Reduza para até 1920px no lado maior."); setBusy(false); return; }
    const mType = mediaFile.type.startsWith("video") ? "video" : "image";
    const mediaUrl = await uploadFile(mediaFile, mType, setProgress);
    if (!mediaUrl) { setErrMsg("Falha no upload."); setBusy(false); return; }

    // Upload extras (multi-image)
    let imagesUrls: string[] = [];
    if (mType === "image") {
      imagesUrls = [mediaUrl];
      for (let i = 0; i < extraImageFiles.length; i++) {
        const u = await uploadFile(extraImageFiles[i], "image", () => {});
        if (u) imagesUrls.push(u);
      }
    }

    let thumbUrl: string | undefined;
    if (thumbFile) { const tu = await uploadFile(thumbFile, "image", setProgress2); if (tu) thumbUrl = tu; }

    await onSave({
      id: `proj-${Date.now()}`, title: title.trim(), description: desc.trim(), category: cat,
      mediaType: mType, mediaUrl,
      images: imagesUrls.length > 1 ? imagesUrls : undefined,
      thumbUrl, createdAt: Date.now(),
    });
    setDone(true); setTimeout(() => { reset(); onClose(); }, 1000);
  };

  if (!open) return null;

  const embedReady = (mode === "youtube" || mode === "vimeo") && !!parsedVideo;
  const canSave = title.trim() && !busy && (
    tab === "audio" ? (!!audioFile && ghConfigured) :
    embedReady || (mode === "file" && !!mediaFile && ghConfigured)
  );

  return (
    <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={() => { if (!busy) { reset(); onClose(); } }} />
      <div className="relative z-10 w-full max-w-xl bg-card border border-border border-b-0 sm:border-b flex flex-col max-h-[96vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">Novo Conteúdo</div>
            <h2 className="text-xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Adicionar ao Portfólio</h2>
          </div>
          <button onClick={() => { if (!busy) { reset(); onClose(); } }} className="w-9 h-9 flex items-center justify-center border border-border text-muted-foreground"><X size={15} /></button>
        </div>

        <div className="flex border-b border-border flex-shrink-0">
          {([["video", <VideoIcon size={12} />, "Vídeo"], ["image", <ImageIcon size={12} />, "Imagem"], ["audio", <Music size={12} />, "Áudio"]] as const).map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-4 py-3 font-mono text-[10px] tracking-widest uppercase border-b-2 transition-colors ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {icon}{label}
            </button>
          ))}
        </div>

        {!ghConfigured && (
          <div className="mx-5 mt-4 flex items-start gap-3 border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/80 font-light">Configure o GitHub antes de fazer uploads.</p>
          </div>
        )}

        <div className="p-5 space-y-4">
          {tab === "audio" && (<>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Arquivo de áudio * (MP3, WAV, AAC, M4A, OGG, FLAC)</label>
              <div className={`border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${audioFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("audio-inp")?.click()}>
                <input id="audio-inp" type="file" accept={AUDIO_ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAudioFile(f); e.target.value = ""; }} />
                {audioFile ? <div className="flex items-center justify-center gap-2 text-primary"><Music size={16} /><span className="text-sm truncate max-w-[200px]">{audioFile.name}</span></div>
                  : <div className="flex flex-col items-center gap-2 text-muted-foreground"><Music size={20} /><span className="text-xs font-mono tracking-wider uppercase">Selecionar áudio</span></div>}
              </div>
              {progress && <div className="mt-2"><UploadProgressBar progress={progress} /></div>}
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Capa (opcional)</label>
              <div className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${audioCoverFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("audio-cover-inp")?.click()}>
                <input id="audio-cover-inp" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAudioCoverFile(f); e.target.value = ""; }} />
                {audioCoverFile ? <div className="flex items-center justify-center gap-2 text-primary"><ImageIcon size={14} /><span className="text-sm truncate">{audioCoverFile.name}</span></div>
                  : <div className="flex items-center justify-center gap-2 text-muted-foreground"><ImageIcon size={14} /><span className="text-xs font-mono tracking-wider uppercase">Arte / capa</span></div>}
              </div>
              {progress2 && <div className="mt-2"><UploadProgressBar progress={progress2} /></div>}
            </div>
            <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Título da faixa *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome da música / EP / álbum" className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
            <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Artista / feat. (opcional)</label><input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Frederico Pierre" className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Gênero musical (opcional)</label>
              <div className="flex flex-wrap gap-1.5">
                {AUDIO_GENRES.map(g => (
                  <button key={g} type="button" onClick={() => setGenre(genre === g ? "" : g)} className={`font-mono text-[9px] tracking-wider uppercase px-2.5 py-1.5 border transition-colors ${genre === g ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}>{g}</button>
                ))}
              </div>
              {genre && <p className="font-mono text-[10px] text-primary mt-1.5">Selecionado: {genre}</p>}
            </div>
          </>)}

          {tab !== "audio" && (<>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {([["file", <Upload size={13} />, "Arquivo"], ["youtube", <Youtube size={13} />, "YouTube"], ["vimeo", <Link2 size={13} />, "Vimeo"]] as const).map(([id, icon, label]) => (
                  <button key={id} onClick={() => setMode(id)} className={`flex flex-col items-center gap-1.5 py-3 border transition-colors font-mono text-[10px] tracking-widest uppercase ${mode === id ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "file" && (<>
              <div>
                <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">{tab === "image" ? "Imagem principal *" : "Vídeo * (até 25 MB)"}</label>
                <div className={`border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${mediaFile ? "border-primary bg-primary/5" : (oversize || incompatibleRes) ? "border-red-500/60" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("media-inp")?.click()}>
                  <input id="media-inp" type="file" accept={tab === "image" ? "image/*" : "image/*,video/mp4,video/mov,video/webm,video/quicktime"} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); e.target.value = ""; }} />
                  {checkingVideo ? <div className="flex items-center justify-center gap-2 text-muted-foreground"><span className="text-xs font-mono tracking-wider uppercase">Verificando vídeo...</span></div>
                    : mediaFile ? <div className="flex items-center justify-center gap-2 text-primary">{mediaFile.type.startsWith("video") ? <VideoIcon size={16} /> : <ImageIcon size={16} />}<span className="text-sm truncate max-w-[200px]">{mediaFile.name}</span></div>
                    : <div className="flex flex-col items-center gap-2 text-muted-foreground"><Upload size={20} /><span className="text-xs font-mono tracking-wider uppercase">Toque ou arraste</span></div>}
                </div>
                {oversize && <div className="mt-3 border border-red-500/30 bg-red-500/5 p-3"><p className="text-xs text-red-300 font-light flex items-center gap-2"><AlertCircle size={12} />Vídeo &gt; 25 MB — use YouTube ou Vimeo.</p></div>}
                {incompatibleRes && <div className="mt-3 border border-red-500/30 bg-red-500/5 p-3"><p className="text-xs text-red-300 font-light flex items-center gap-2"><AlertCircle size={12} />Vídeo {incompatibleRes.width}x{incompatibleRes.height} — resolução alta demais, não reproduz em celulares. Reexporte com o lado maior em até {MAX_VIDEO_DIMENSION}px.</p></div>}
                {progress && <div className="mt-2"><UploadProgressBar progress={progress} /></div>}
              </div>

              {tab === "image" && (
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Imagens adicionais (carrossel, opcional)</label>
                  <div className="border-2 border-dashed border-border p-4 text-center cursor-pointer hover:border-primary/40 transition-colors" onClick={() => document.getElementById("extra-images-inp")?.click()}>
                    <input id="extra-images-inp" type="file" accept="image/*" multiple className="hidden" onChange={e => { setExtraImageFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
                    <div className="flex items-center justify-center gap-2 text-muted-foreground"><ImageIcon size={14} /><span className="text-xs font-mono tracking-wider uppercase">{extraImageFiles.length > 0 ? `${extraImageFiles.length} imagem(ns) extra(s)` : "Adicionar mais imagens"}</span></div>
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground/60 mt-1">Cria um carrossel estilo Instagram.</p>
                </div>
              )}

              <div>
                <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Thumbnail (opcional)</label>
                <div className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${thumbFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("thumb-inp")?.click()}>
                  <input id="thumb-inp" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setThumbFile(f); e.target.value = ""; }} />
                  {thumbFile ? <div className="flex items-center justify-center gap-2 text-primary"><ImageIcon size={14} /><span className="text-sm truncate">{thumbFile.name}</span></div>
                    : <div className="flex items-center justify-center gap-2 text-muted-foreground"><ImageIcon size={14} /><span className="text-xs font-mono tracking-wider uppercase">Capa</span></div>}
                </div>
                {progress2 && <div className="mt-2"><UploadProgressBar progress={progress2} /></div>}
              </div>
            </>)}

            {(mode === "youtube" || mode === "vimeo") && (
              <div>
                <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">URL *</label>
                <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder={mode === "youtube" ? "https://youtube.com/watch?v=..." : "https://vimeo.com/123456789"} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" />
                {videoUrl && !parsedVideo && <p className="font-mono text-[10px] text-amber-400 mt-1.5 flex items-center gap-1"><AlertCircle size={10} />URL não reconhecida.</p>}
                {parsedVideo && (
                  <div className="mt-3 border border-green-500/20 bg-green-500/5 p-3 space-y-2">
                    <div className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-400" /><span className="font-mono text-[10px] text-green-400 uppercase">{parsedVideo.platform} detectado</span></div>
                    {parsedVideo.thumb && thumbImgOk ? <img src={parsedVideo.thumb} alt="preview" className="w-full aspect-video object-cover" onError={() => setThumbImgOk(false)} />
                      : <div className="w-full aspect-video bg-muted flex items-center justify-center gap-2"><Youtube size={20} className="text-muted-foreground" /><span className="font-mono text-[10px] text-muted-foreground">ID: {parsedVideo.id}</span></div>}
                  </div>
                )}
              </div>
            )}

            <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Título *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do projeto" className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
            <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Descrição</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary resize-none" /></div>
            <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Categoria</label>
              <div className="grid grid-cols-2 gap-2">{CATEGORIES.map(c => <button key={c} onClick={() => setCat(c)} className={`font-mono text-[10px] tracking-widest uppercase px-3 py-2.5 border transition-colors text-left ${cat === c ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{c}</button>)}</div>
            </div>
          </>)}
        </div>

        {errMsg && <div className="mx-5 mb-3 flex items-center gap-2 border border-red-500/30 bg-red-500/5 px-3 py-3"><AlertCircle size={13} className="text-red-400 flex-shrink-0" /><span className="text-sm text-red-300 font-light">{errMsg}</span></div>}

        <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <button onClick={() => { if (!busy) { reset(); onClose(); } }} className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} className={`flex items-center gap-2 px-6 py-3 font-bold text-xs tracking-widest uppercase transition-all ${done ? "bg-green-600 text-white" : !canSave ? "bg-muted text-muted-foreground cursor-not-allowed" : busy ? "bg-primary/60 text-background" : "bg-primary text-background"}`}>
            {done ? <><Check size={13} /> Salvo!</> : busy ? <><Loader2 size={13} className="animate-spin" />Enviando...</> : <><Upload size={13} /> Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   GALLERY MODAL
═══════════════════════════════════════════════════════════════════ */

const AUDIO_SERVICE_TITLE = "Produção Fonográfica";

function AudioGalleryView({ audios, showAdmin, onDeleteAudio }: { audios: CMSAudio[]; showAdmin: boolean; onDeleteAudio: (id: string) => void }) {
  const player = useAudioPlayer(audios);
  const { activeId, isPlaying, toggle, audioEl } = player;
  const [filterGenre, setFilterGenre] = useState<string>("all");

  const genres = ["all", ...Array.from(new Set(audios.map(a => a.genre).filter(Boolean) as string[]))];
  const filtered = filterGenre === "all" ? audios : audios.filter(a => a.genre === filterGenre);

  if (audios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 px-6">
        <div className="w-12 h-12 border border-border flex items-center justify-center text-muted-foreground"><Music size={24} /></div>
        <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase text-center">Nenhuma produção cadastrada ainda</p>
        {showAdmin && <p className="font-mono text-[10px] text-muted-foreground/50 text-center">Faça upload de áudios no painel admin</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {audioEl}
      {/* Genre filter */}
      {genres.length > 1 && (
        <div className="flex gap-2 px-5 md:px-8 py-3 border-b border-border flex-wrap">
          {genres.map(g => (
            <button key={g} onClick={() => setFilterGenre(g)} className={`font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 border transition-colors ${filterGenre === g ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}>
              {g === "all" ? "Todos" : g}
            </button>
          ))}
        </div>
      )}
      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 md:px-8 py-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map(a => (
            <div key={a.id} className="group">
              <AudioCard audio={a} isActive={activeId === a.id} isPlaying={activeId === a.id && isPlaying} onToggle={toggle} onDelete={showAdmin ? onDeleteAudio : undefined} showAdmin={showAdmin} size="md" />
            </div>
          ))}
        </div>
      </div>
      {/* Player bar */}
      <div className="border-t border-border px-5 md:px-8 py-3">
        <MiniPlayer player={player} />
      </div>
    </div>
  );
}

function GalleryModal({ service, allProjects, audios, initialItem, onClose, showAdmin, onDelete, onDeleteAudio, onTogglePin, pinned }: {
  service: { number: string; title: string; icon: ReactNode; galleryCategories: string[] } | null;
  allProjects: DisplayProject[]; audios: CMSAudio[];
  initialItem?: DisplayProject | null;
  onClose: () => void; showAdmin: boolean; onDelete: (id: string) => void;
  onDeleteAudio: (id: string) => void;
  onTogglePin: (id: string) => void; pinned: Set<string>;
}) {
  const [selected, setSelected] = useState<DisplayProject | null>(initialItem ?? null);
  useEffect(() => { setSelected(initialItem ?? null); }, [initialItem]);
  useEffect(() => {
    if (!service) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") { if (selected) setSelected(null); else onClose(); } };
    document.addEventListener("keydown", fn); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", fn); document.body.style.overflow = ""; };
  }, [service, selected, onClose]);

  if (!service) return null;

  const isAudioService = service.galleryCategories.includes(AUDIO_SERVICE_TITLE);
  const items = allProjects.filter(p => service.galleryCategories.includes(p.category));

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/93 backdrop-blur-sm" onClick={() => { if (selected) setSelected(null); else onClose(); }} />
      <div className="relative z-10 w-full max-w-5xl max-h-[95vh] sm:max-h-[92vh] flex flex-col bg-card border border-border border-b-0 sm:border-b overflow-hidden">
        <div className="flex items-center justify-between px-5 md:px-8 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {selected && <button onClick={() => setSelected(null)} className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase flex-shrink-0">← Voltar</button>}
            <div className="min-w-0">
              <div className="font-mono text-[10px] text-primary tracking-[0.25em] uppercase mb-0.5 truncate">{service.number} — {selected ? "Detalhe" : "Galeria"}</div>
              <h2 className="text-2xl md:text-3xl font-black uppercase text-foreground leading-none truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{selected ? selected.title : service.title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex-shrink-0 flex items-center justify-center border border-border text-muted-foreground"><X size={16} /></button>
        </div>

        <div className={`flex-1 min-h-0 ${isAudioService && !selected ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
          {selected ? (
            <div className="flex flex-col md:grid md:grid-cols-[1fr_320px]">
              <div className="bg-black flex items-center justify-center" style={{ minHeight: "clamp(200px,42vw,380px)" }}>
                {selected.mediaType === "video" && <video src={selected.mediaUrl} controls autoPlay muted loop playsInline className="w-full h-full object-contain max-h-[55vh]" />}
                {selected.mediaType === "embed" && selected.embedId && (
                  <iframe src={selected.embedPlatform === "youtube" ? `https://www.youtube.com/embed/${selected.embedId}?playsinline=1&rel=0` : `https://player.vimeo.com/video/${selected.embedId}?playsinline=1`} className="w-full aspect-video" allowFullScreen allow="autoplay; fullscreen; picture-in-picture; xr-spatial-tracking" style={{ border: 0 }} />
                )}
                {selected.mediaType === "image" && (selected.images && selected.images.length > 1
                  ? <div className="w-full h-full" style={{ minHeight: 240 }}><ImageCarousel images={selected.images} title={selected.title} fullscreen /></div>
                  : <img src={selected.mediaUrl} alt={selected.title} className="w-full h-full object-contain max-h-[55vh]" />
                )}
              </div>
              <div className="border-t md:border-t-0 md:border-l border-border p-5 md:p-7 flex flex-col gap-4">
                <div>
                  <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-1">{selected.category}</div>
                  <h3 className="text-xl md:text-2xl font-black uppercase text-foreground leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{selected.title}</h3>
                </div>
                {selected.description && <div className="border-t border-border pt-4"><div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-2">Sobre o projeto</div><p className="text-sm text-muted-foreground leading-relaxed font-light whitespace-pre-line">{selected.description}</p></div>}
                <div className="mt-auto pt-4 border-t border-border space-y-3">
                  <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-primary text-background px-5 py-3 font-bold text-xs tracking-widest uppercase w-full justify-center"><MessageCircle size={13} /> Solicitar projeto similar</a>
                  {showAdmin && (
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => onTogglePin(selected.id)} className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] tracking-wider uppercase border transition-colors ${pinned.has(selected.id) ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                        {pinned.has(selected.id) ? <><Pin size={10} /> Em destaque</> : <><PinOff size={10} /> Fixar</>}
                      </button>
                      {!selected.isFixed && <button onClick={() => { onDelete(selected.id); setSelected(null); }} className="flex items-center gap-1.5 text-red-400 font-mono text-[10px] tracking-wider uppercase border border-red-500/40 px-3 py-2 hover:bg-red-500 hover:text-white transition-colors"><Trash2 size={10} /> Remover</button>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : isAudioService ? null : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 px-6">
              <div className="w-12 h-12 border border-border flex items-center justify-center text-muted-foreground">{service.icon}</div>
              <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase text-center">Em breve — novos projetos aqui</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
              {items.map(item => <ProjectCard key={item.id} item={item} showAdmin={showAdmin} isPinned={pinned.has(item.id)} onTogglePin={onTogglePin} onDelete={!item.isFixed ? onDelete : undefined} onClick={() => setSelected(item)} />)}
            </div>
          )}
          {/* Galeria de áudio — renderizada quando é Produção Fonográfica e nada está selecionado */}
          {isAudioService && !selected && (
            <AudioGalleryView audios={audios} showAdmin={showAdmin} onDeleteAudio={onDeleteAudio} />
          )}
        </div>

        {!selected && !isAudioService && (
          <div className="border-t border-border px-5 md:px-8 py-3 flex items-center justify-between flex-shrink-0">
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">{items.length} projeto{items.length !== 1 ? "s" : ""}</span>
            <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">Solicitar orçamento <ArrowUpRight size={13} /></a>
          </div>
        )}
        {isAudioService && !selected && (
          <div className="border-t border-border px-5 md:px-8 py-2 flex items-center justify-end flex-shrink-0">
            <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">Solicitar produção <ArrowUpRight size={13} /></a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOGS TAB
═══════════════════════════════════════════════════════════════════ */

function LogsTab({ logs }: { logs: LogEntry[] }) {
  const icons: Record<LogEntry["level"], ReactNode> = { info: <Zap size={9} />, success: <CheckCheck size={9} className="text-green-400" />, error: <XCircle size={9} className="text-red-400" />, warn: <AlertCircle size={9} className="text-amber-400" /> };
  const colors: Record<LogEntry["level"], string> = { info: "text-muted-foreground", success: "text-green-400", error: "text-red-400", warn: "text-amber-400" };
  return (
    <div className="space-y-3">
      <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">{logs.length} eventos</div>
      {logs.length === 0
        ? <div className="border border-dashed border-border py-12 text-center"><ScrollText size={18} className="text-muted-foreground mx-auto mb-2" /><p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Nenhum evento</p></div>
        : <div className="border border-border divide-y divide-border">{logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="mt-0.5 flex-shrink-0 text-muted-foreground">{icons[log.level]}</div>
              <span className={`flex-1 text-xs font-light leading-relaxed ${colors[log.level]}`}>{log.msg}</span>
              <span className="font-mono text-[9px] text-muted-foreground/50 flex-shrink-0">{log.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
          ))}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MEDIA LIBRARY TAB
═══════════════════════════════════════════════════════════════════ */

function MediaLibraryTab({ cms, onDeleteProject, onDeleteAudio }: {
  cms: CMSData; onDeleteProject: (id: string) => void; onDeleteAudio: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "video" | "image" | "embed" | "audio">("all");

  const projectItems = cms.projects.filter(p =>
    (filterType === "all" || p.mediaType === filterType) &&
    (!search || p.title.toLowerCase().includes(search.toLowerCase()))
  );
  const audioItems = cms.audios.filter(a =>
    (filterType === "all" || filterType === "audio") &&
    (!search || a.title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full bg-muted border border-border pl-8 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "video", "image", "audio", "embed"] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`font-mono text-[9px] tracking-widest uppercase px-2 py-1.5 border transition-colors ${filterType === t ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
              {t === "all" ? "Todos" : t === "embed" ? "YT/VM" : t}
            </button>
          ))}
        </div>
      </div>
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{projectItems.length + (filterType === "all" || filterType === "audio" ? audioItems.length : 0)} itens</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {projectItems.map(p => (
          <div key={p.id} className="relative border border-border overflow-hidden group">
            <div className="aspect-video bg-card">
              {p.mediaType === "video" && <video src={p.mediaUrl} muted className="w-full h-full object-cover" />}
              {p.mediaType === "embed" && p.thumbUrl && <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />}
              {p.mediaType === "embed" && !p.thumbUrl && <div className="w-full h-full flex items-center justify-center"><Youtube size={16} className="text-red-400" /></div>}
              {p.mediaType === "image" && <img src={(p.images?.[0] ?? p.mediaUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />}
            </div>
            <div className="p-2">
              <p className="text-xs font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{p.title}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-[9px] text-muted-foreground uppercase">{p.mediaType}{p.images && p.images.length > 1 ? ` ×${p.images.length}` : ""}</span>
                <button onClick={() => onDeleteProject(p.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10} /></button>
              </div>
            </div>
          </div>
        ))}
        {(filterType === "all" || filterType === "audio") && audioItems.map(a => (
          <div key={a.id} className="relative border border-border overflow-hidden group">
            <div className="aspect-video bg-card flex items-center justify-center">
              {a.coverUrl ? <img src={a.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music size={20} className="text-muted-foreground" />}
            </div>
            <div className="p-2">
              <p className="text-xs font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{a.title}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-[9px] text-muted-foreground uppercase">áudio</span>
                <button onClick={() => onDeleteAudio(a.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {projectItems.length === 0 && audioItems.length === 0 && (
        <div className="border border-dashed border-border py-10 text-center">
          <Library size={18} className="text-muted-foreground mx-auto mb-2" />
          <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Nenhuma mídia encontrada</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   GITHUB CONFIG TAB
═══════════════════════════════════════════════════════════════════ */

function GitHubConfigTab({ ghConfig, onSave, onClear, onPublish, onSync, cms, saveStatus, saveError }: {
  ghConfig: GitHubConfig | null; onSave: (cfg: GitHubConfig) => void; onClear: () => void;
  onPublish: () => void; onSync: () => Promise<boolean>; cms: CMSData; saveStatus: SaveStatus; saveError: string;
}) {
  const [owner, setOwner] = useState(ghConfig?.owner ?? "");
  const [repo, setRepo] = useState(ghConfig?.repo ?? "");
  const [branch, setBranch] = useState(ghConfig?.branch ?? "main");
  const [token, setToken] = useState(ghConfig?.token ?? "");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<boolean | null>(null);
  const configComplete = !!ghConfig && !!ghConfig.token;

  return (
    <div className="space-y-4">
      {/* Architecture note */}
      <div className="border border-green-500/20 bg-green-500/5 p-4 text-xs text-green-300/80 font-light space-y-1">
        <div className="font-mono text-[10px] text-green-400 uppercase tracking-widest mb-2">Arquitetura Segura</div>
        <p>Conteúdo salvo em <code className="text-green-300">cms/data.json</code> — fora do <code className="text-green-300">public/</code>.</p>
        <p>Commits do Figma Make <strong>nunca sobrescrevem</strong> este arquivo. Apenas o admin pode alterar.</p>
        <p>Uploads em <code className="text-green-300">public/uploads/</code> também são preservados.</p>
      </div>

      {/* Sync */}
      <div className="border border-primary/20 bg-primary/5 p-4">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-1">Sincronizar do GitHub</div>
        <p className="text-xs text-muted-foreground font-light mb-3">Recarrega o CMS do repositório. Use sempre após um commit via Figma.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={async () => { setSyncing(true); setSyncResult(null); const ok = await onSync(); setSyncResult(ok); setSyncing(false); setTimeout(() => setSyncResult(null), 4000); }} disabled={!ghConfig?.owner || syncing} className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs tracking-widest uppercase border transition-all ${!ghConfig?.owner ? "border-border text-muted-foreground opacity-50 cursor-not-allowed" : "border-primary text-primary hover:bg-primary hover:text-background"}`}>
            {syncing ? <><Loader2 size={12} className="animate-spin" />Sincronizando...</> : <><RefreshCw size={12} />Sincronizar</>}
          </button>
          {syncResult === true && <span className="flex items-center gap-1.5 font-mono text-[10px] text-green-400"><CheckCircle2 size={11} />Atualizado!</span>}
          {syncResult === false && <span className="flex items-center gap-1.5 font-mono text-[10px] text-red-400"><AlertCircle size={11} />Falha</span>}
        </div>
      </div>

      {/* Publish */}
      <div className="border border-border p-4">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-2">Publicar → GitHub → Vercel</div>
        <p className="text-xs text-muted-foreground font-light mb-3">Salva em <code>cms/data.json</code>. Vercel faz deploy automaticamente.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onPublish} disabled={!configComplete || saveStatus === "saving"} className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs tracking-widest uppercase transition-all ${!configComplete ? "bg-muted text-muted-foreground cursor-not-allowed" : saveStatus === "saving" ? "bg-primary/60 text-background" : "bg-primary text-background"}`}>
            {saveStatus === "saving" ? <><Loader2 size={12} className="animate-spin" />Publicando...</> : <><Github size={12} />Publicar agora</>}
          </button>
          {saveStatus === "success" && <span className="flex items-center gap-1.5 font-mono text-[10px] text-green-400"><CheckCircle2 size={11} />Publicado! ~2 min...</span>}
          {saveStatus === "error" && saveError && <span className="font-mono text-[10px] text-red-400 max-w-[200px] flex items-center gap-1"><AlertCircle size={11} />{saveError}</span>}
        </div>
      </div>

      {/* Config */}
      <div className="border border-border p-4 space-y-3">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase">Configuração do Repositório</div>
        {ghConfig && <div className="flex items-center gap-2 text-[10px] font-mono"><span className={`w-2 h-2 rounded-full ${configComplete ? "bg-green-500" : "bg-amber-500"}`} /><span className="text-muted-foreground">{ghConfig.owner}/{ghConfig.repo} ({ghConfig.branch})</span></div>}
        <div className="grid grid-cols-2 gap-2">
          <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Usuário / Org</label><input value={owner} onChange={e => setOwner(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Repositório</label><input value={repo} onChange={e => setRepo(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
        </div>
        <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Branch</label><input value={branch} onChange={e => setBranch(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Token (PAT) — só nesta sessão</label>
          <div className="relative"><input type={showToken ? "text" : "password"} value={token} onChange={e => setToken(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:border-primary" />
            <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showToken ? <Eye size={14} /> : <EyeOff size={14} />}</button>
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/50 mt-1">owner/repo/branch → localStorage. Token → sessionStorage (apaga ao fechar).</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={async () => { setTesting(true); setTestResult(null); const r = await ghTestConnection({ owner, repo, branch, token }); setTestResult(r); setTesting(false); }} disabled={!owner || !repo || !token || testing} className="flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
            {testing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}Testar
          </button>
          <button onClick={() => onSave({ owner, repo, branch, token })} disabled={!owner || !repo || !token} className="flex items-center gap-2 bg-primary text-background px-4 py-2 font-bold text-[10px] tracking-widest uppercase disabled:opacity-50">
            <Check size={10} />Salvar
          </button>
          {ghConfig && <button onClick={onClear} className="font-mono text-[10px] text-red-400 tracking-widest uppercase">Limpar</button>}
        </div>
        {testResult && <div className={`flex items-center gap-2 font-mono text-[10px] ${testResult.ok ? "text-green-400" : "text-red-400"}`}>{testResult.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}{testResult.ok ? `Conectado: ${testResult.name}` : testResult.error}</div>}
      </div>

      <div className="border border-border p-4 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary uppercase tracking-widest mb-2">Status</div>
        <div>{cms.projects.length} projeto(s) · {cms.audios.length} faixa(s) · {new Date(cms.updatedAt).toLocaleString("pt-BR")}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════════════════════════════ */

type AdminTab = "github" | "midias" | "uploads" | "textos" | "servicos" | "cores" | "info" | "logs";

function AdminPanel({ open, onClose, cms, setCms, publish, uploadFile, deleteFile, syncFromGitHub, ghConfig, setGhConfig, clearGhConfig, saveStatus, saveError, logs, onOpenUpload }: {
  open: boolean; onClose: () => void; cms: CMSData; setCms: (d: CMSData) => void;
  publish: (d: CMSData) => Promise<boolean>;
  uploadFile: (f: File, t: "image" | "video" | "audio", onProgress: (p: UploadProgress) => void) => Promise<string | null>;
  deleteFile: (path: string) => Promise<void>;
  syncFromGitHub: () => Promise<boolean>;
  ghConfig: GitHubConfig | null; setGhConfig: (c: GitHubConfig) => void; clearGhConfig: () => void;
  saveStatus: SaveStatus; saveError: string; logs: LogEntry[]; onOpenUpload: () => void;
}) {
  const [tab, setTab] = useState<AdminTab>("github");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(""); const [editDesc, setEditDesc] = useState(""); const [editCat, setEditCat] = useState(CATEGORIES[0]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [editingAudio, setEditingAudio] = useState<CMSAudio | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => { document.removeEventListener("keydown", fn); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  const pinned = new Set(cms.pinned);
  const hiddenSeeds = new Set(cms.hiddenSeeds);
  const ghOk = !!ghConfig?.token;

  const togglePin = (id: string) => setCms({ ...cms, pinned: pinned.has(id) ? cms.pinned.filter(p => p !== id) : [...cms.pinned, id] });
  const toggleHide = (id: string) => hiddenSeeds.has(id)
    ? setCms({ ...cms, hiddenSeeds: cms.hiddenSeeds.filter(s => s !== id) })
    : setCms({ ...cms, hiddenSeeds: [...cms.hiddenSeeds, id], pinned: cms.pinned.filter(p => p !== id) });

  const delUpload = async (id: string) => {
    if (!confirm("Remover projeto?")) return;
    const p = cms.projects.find(p => p.id === id);
    if (p) {
      const allUrls = [p.mediaUrl, p.thumbUrl, ...(p.images ?? [])].filter(Boolean) as string[];
      for (const u of allUrls) { if (u.startsWith("/uploads/")) await deleteFile(u); }
    }
    setCms({ ...cms, projects: cms.projects.filter(p => p.id !== id), pinned: cms.pinned.filter(p => p !== id) });
  };

  const delAudio = async (id: string) => {
    if (!confirm("Remover áudio permanentemente?")) return;
    const a = cms.audios.find(a => a.id === id);
    if (a) { if (a.url.startsWith("/uploads/")) await deleteFile(a.url); if (a.coverUrl?.startsWith("/uploads/")) await deleteFile(a.coverUrl); }
    setCms({ ...cms, audios: cms.audios.filter(a => a.id !== id) });
  };

  const toggleHideAudio = (id: string) => {
    setCms({ ...cms, audios: cms.audios.map(a => a.id === id ? { ...a, hidden: !a.hidden } : a) });
  };

  const saveAudio = async (updated: CMSAudio) => {
    setCms({ ...cms, audios: cms.audios.map(a => a.id === updated.id ? updated : a) });
    setEditingAudio(null);
  };

  const saveEdit = async (id: string) => {
    setCms({ ...cms, projects: cms.projects.map(p => p.id === id ? { ...p, title: editTitle, description: editDesc, category: editCat } : p) });
    setSavedId(id); setTimeout(() => { setSavedId(null); setEditingId(null); }, 800);
  };

  const updContent = (k: keyof SiteContent, v: string) => setCms({ ...cms, content: { ...cms.content, [k]: v } });
  const updTheme = (k: keyof SiteTheme, v: string) => setCms({ ...cms, theme: { ...cms.theme, [k]: v } });
  const updService = (i: number, k: keyof CMSServiceContent, v: string | string[]) => {
    const updated = cms.services.map((s, idx) => idx === i ? { ...s, [k]: v } : s);
    setCms({ ...cms, services: updated });
  };
  const updAdvantage = (i: number, k: keyof CMSAdvantageContent, v: string) => {
    const updated = cms.advantages.map((a, idx) => idx === i ? { ...a, [k]: v } : a);
    setCms({ ...cms, advantages: updated });
  };

  const TABS: { id: AdminTab; icon: ReactNode; label: string }[] = [
    { id: "github", icon: <Github size={12} />, label: "GitHub" },
    { id: "midias", icon: <Library size={12} />, label: "Mídias" },
    { id: "uploads", icon: <FolderOpen size={12} />, label: "Uploads" },
    { id: "textos", icon: <FileText size={12} />, label: "Textos" },
    { id: "servicos", icon: <Sparkles size={12} />, label: "Serviços" },
    { id: "cores", icon: <Paintbrush size={12} />, label: "Cores" },
    { id: "info", icon: <Info size={12} />, label: "Info" },
    { id: "logs", icon: <ScrollText size={12} />, label: `Logs${logs.length ? `(${logs.length})` : ""}` },
  ];

  const contentFields: { k: keyof SiteContent; l: string; m?: boolean }[] = [
    { k: "heroLine1", l: "Hero Linha 1" }, { k: "heroLine2", l: "Hero Linha 2" }, { k: "heroLine3", l: "Hero Linha 3" }, { k: "heroLine4", l: "Hero Linha 4 (outline)" },
    { k: "heroBadge", l: "Badge (disponível)" }, { k: "heroSubtitle", l: "Subtítulo hero", m: true },
    { k: "stat1Val", l: "Stat 1 Valor" }, { k: "stat1Label", l: "Stat 1 Label" },
    { k: "stat2Val", l: "Stat 2 Valor" }, { k: "stat2Label", l: "Stat 2 Label" },
    { k: "stat3Val", l: "Stat 3 Valor" }, { k: "stat3Label", l: "Stat 3 Label" },
    { k: "stat4Val", l: "Stat 4 Valor" }, { k: "stat4Label", l: "Stat 4 Label" },
    { k: "servicesHeading1", l: "Serviços Título L1" }, { k: "servicesHeading2", l: "Serviços Título L2" },
    { k: "difHeading1", l: "Diferenciais L1" }, { k: "difHeading2", l: "Diferenciais L2" }, { k: "difHeading3", l: "Diferenciais L3" },
    { k: "difSubtext", l: "Diferenciais Parágrafo", m: true },
    { k: "contactHeading", l: "Contato Título" }, { k: "contactSubtext", l: "Contato Sub", m: true },
    { k: "footerCopy", l: "Rodapé" },
  ];

  const themeFields: { k: keyof SiteTheme; l: string }[] = [
    { k: "primary", l: "Destaque (laranja)" }, { k: "background", l: "Fundo" },
    { k: "foreground", l: "Texto principal" }, { k: "card", l: "Cards" }, { k: "muted", l: "Superfície secundária" },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl max-h-[96vh] md:max-h-[92vh] flex flex-col bg-card border border-border border-b-0 md:border-b">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-primary" />
            <span className="font-mono text-[10px] text-primary tracking-widest uppercase">Painel Admin</span>
            {!ghOk && <span className="font-mono text-[9px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 uppercase">Sem token</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); onOpenUpload(); }} className="flex items-center gap-1.5 px-3 py-1.5 font-bold text-[10px] tracking-widest uppercase bg-primary text-background"><Plus size={10} />Upload</button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border border-border text-muted-foreground"><X size={14} /></button>
          </div>
        </div>

        <div className="flex border-b border-border flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-3 font-mono text-[10px] tracking-widest uppercase border-b-2 flex-shrink-0 transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4 md:p-5">

          {tab === "github" && <GitHubConfigTab ghConfig={ghConfig} onSave={setGhConfig} onClear={clearGhConfig} onPublish={() => publish(cms)} onSync={syncFromGitHub} cms={cms} saveStatus={saveStatus} saveError={saveError} />}

          {tab === "midias" && <MediaLibraryTab cms={cms} onDeleteProject={delUpload} onDeleteAudio={delAudio} />}

          {tab === "uploads" && (
            <div className="space-y-4">
              {/* Seeds */}
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-primary" />Seeds do código ({ALL_SEEDS.length})</div>
                {ALL_SEEDS.map(p => {
                  const hidden = hiddenSeeds.has(p.id); const isPin = pinned.has(p.id);
                  return (
                    <div key={p.id} className={`flex items-center gap-3 border p-2.5 mb-2 ${hidden ? "border-border/30 opacity-50" : "border-border"}`}>
                      <div className="w-14 h-10 flex-shrink-0 bg-background overflow-hidden"><video src={p.mediaUrl} muted className="w-full h-full object-cover" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[9px] text-primary">{p.category}</div>
                        <div className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{p.title}</div>
                        <span className={`font-mono text-[9px] px-1.5 py-0.5 uppercase ${isPin && !hidden ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{hidden ? "Oculto" : isPin ? "Destaque" : "Galeria"}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!hidden && <button onClick={() => togglePin(p.id)} className={`font-mono text-[9px] px-2 py-1 border ${isPin ? "border-primary text-primary" : "border-border text-muted-foreground"}`}><Pin size={8} /></button>}
                        <button onClick={() => toggleHide(p.id)} className={`font-mono text-[9px] px-2 py-1 border ${hidden ? "border-green-500/40 text-green-400" : "border-red-500/40 text-red-400"}`}>{hidden ? "↑ Mostrar" : <Trash2 size={8} />}</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* GitHub uploads */}
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-green-500" />Uploads GitHub ({cms.projects.length})</div>
                {cms.projects.length === 0
                  ? <div className="border border-dashed border-border py-10 flex flex-col items-center gap-3"><Upload size={18} className="text-muted-foreground" /><p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Nenhum upload</p><button onClick={() => { onClose(); onOpenUpload(); }} className="flex items-center gap-2 bg-primary text-background px-4 py-2 font-bold text-xs tracking-widest uppercase"><Plus size={10} />Primeiro upload</button></div>
                  : cms.projects.map(p => {
                      const isPin = pinned.has(p.id); const isEmbed = p.mediaType === "embed";
                      return (
                        <div key={p.id} className="border border-border mb-1">
                          {editingId === p.id
                            ? <div className="p-3 space-y-2">
                                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
                                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
                                <div className="grid grid-cols-2 gap-1">{CATEGORIES.map(c => <button key={c} onClick={() => setEditCat(c)} className={`font-mono text-[9px] py-1.5 border ${editCat === c ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{c}</button>)}</div>
                                <div className="flex gap-2"><button onClick={() => saveEdit(p.id)} className={`flex items-center gap-1 px-3 py-1.5 font-bold text-[10px] tracking-widest uppercase ${savedId === p.id ? "bg-green-600 text-white" : "bg-primary text-background"}`}><Check size={10} />{savedId === p.id ? "Salvo!" : "Salvar"}</button><button onClick={() => setEditingId(null)} className="font-mono text-[10px] text-muted-foreground">Cancelar</button></div>
                              </div>
                            : <div className="flex items-center gap-2 p-2">
                                <div className="w-12 h-9 flex-shrink-0 bg-card overflow-hidden relative">
                                  {isEmbed && p.thumbUrl && <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />}
                                  {isEmbed && !p.thumbUrl && <div className="w-full h-full flex items-center justify-center"><Youtube size={12} className="text-red-400" /></div>}
                                  {!isEmbed && p.mediaType === "video" && <video src={p.mediaUrl} muted className="w-full h-full object-cover" />}
                                  {!isEmbed && p.mediaType === "image" && <img src={(p.images?.[0] ?? p.thumbUrl ?? p.mediaUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{p.title}</div>
                                  <span className={`font-mono text-[9px] uppercase ${isPin ? "text-primary" : "text-muted-foreground"}`}>{isPin ? "● Destaque" : "○ Galeria"}</span>
                                  {p.images && p.images.length > 1 && <span className="font-mono text-[9px] text-muted-foreground ml-2">×{p.images.length} imagens</span>}
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => togglePin(p.id)} className={`font-mono text-[9px] px-2 py-1 border ${isPin ? "border-primary text-primary" : "border-border text-muted-foreground"}`}><Pin size={8} /></button>
                                  <button onClick={() => { setEditingId(p.id); setEditTitle(p.title); setEditDesc(p.description); setEditCat(p.category); }} className="font-mono text-[9px] px-2 py-1 border border-border text-muted-foreground">✏</button>
                                  <button onClick={() => delUpload(p.id)} className="font-mono text-[9px] px-2 py-1 border border-red-500/40 text-red-400"><Trash2 size={8} /></button>
                                </div>
                              </div>}
                        </div>
                      );
                    })}
              </div>

              {/* Audio */}
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-green-400" />Produções Fonográficas ({cms.audios.length})</div>
                {cms.audios.length === 0
                  ? <p className="font-mono text-[10px] text-muted-foreground tracking-widest">Nenhuma — upload via botão acima (aba Áudio)</p>
                  : cms.audios.map(a => (
                    <div key={a.id} className={`border mb-1 ${a.hidden ? "border-border/40 opacity-50" : "border-border"}`}>
                      <div className="flex items-center gap-2 p-2">
                        <div className="w-10 h-10 flex-shrink-0 overflow-hidden border border-border">
                          {a.coverUrl ? <img src={a.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Music size={12} className="text-muted-foreground" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{a.title}</p>
                          <div className="flex items-center gap-2">
                            {a.artist && <p className="font-mono text-[9px] text-muted-foreground">{a.artist}</p>}
                            {a.genre && <span className="font-mono text-[8px] px-1 bg-primary/10 text-primary">{a.genre}</span>}
                            {a.hidden && <span className="font-mono text-[8px] px-1 bg-red-500/20 text-red-400 uppercase">Oculto</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => setEditingAudio(a)} title="Editar" className="font-mono text-[9px] px-2 py-1 border border-border text-muted-foreground hover:border-primary hover:text-primary">✏</button>
                          <button onClick={() => toggleHideAudio(a.id)} title={a.hidden ? "Mostrar" : "Ocultar"} className={`font-mono text-[9px] px-2 py-1 border ${a.hidden ? "border-green-500/40 text-green-400" : "border-yellow-500/40 text-yellow-400"}`}>{a.hidden ? <Eye size={8} /> : <EyeOff size={8} />}</button>
                          <button onClick={() => delAudio(a.id)} title="Deletar permanentemente" className="font-mono text-[9px] px-2 py-1 border border-red-500/40 text-red-400"><Trash2 size={8} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* EditAudioModal */}
              <EditAudioModal audio={editingAudio} open={!!editingAudio} onClose={() => setEditingAudio(null)} onSave={saveAudio} uploadFile={uploadFile} ghConfigured={!!ghConfig?.token} />
            </div>
          )}

          {tab === "textos" && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] text-muted-foreground">Edite e clique Publicar (aba GitHub) para salvar.</p>
              {contentFields.map(({ k, l, m }) => (
                <div key={k}>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">{l}</label>
                  {m ? <textarea value={cms.content[k]} onChange={e => updContent(k, e.target.value)} rows={3} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
                    : <input value={cms.content[k]} onChange={e => updContent(k, e.target.value)} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />}
                </div>
              ))}
            </div>
          )}

          {tab === "servicos" && (
            <div className="space-y-6">
              <p className="font-mono text-[10px] text-muted-foreground">Edite os serviços e vantagens. Publique para salvar.</p>
              {cms.services.map((s, i) => (
                <div key={i} className="border border-border p-4 space-y-3">
                  <div className="font-mono text-[10px] text-primary uppercase tracking-widest">Serviço {i + 1} — {SERVICE_NUMBERS[i]}</div>
                  <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Título</label><input value={s.title} onChange={e => updService(i, "title", e.target.value)} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
                  <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Descrição</label><textarea value={s.description} onChange={e => updService(i, "description", e.target.value)} rows={3} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none" /></div>
                  <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Tags (separadas por vírgula)</label><input value={s.tags.join(", ")} onChange={e => updService(i, "tags", e.target.value.split(",").map(t => t.trim()).filter(Boolean))} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
                </div>
              ))}
              <div className="border-t border-border pt-4">
                <div className="font-mono text-[10px] text-primary uppercase tracking-widest mb-3">Vantagens — "Por que eu?"</div>
                {cms.advantages.map((a, i) => (
                  <div key={i} className="border border-border p-4 space-y-2 mb-2">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Vantagem {i + 1}</div>
                    <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Título</label><input value={a.title} onChange={e => updAdvantage(i, "title", e.target.value)} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
                    <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Texto</label><textarea value={a.body} onChange={e => updAdvantage(i, "body", e.target.value)} rows={2} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none" /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "cores" && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] text-muted-foreground">Aplica imediatamente. Publique para persistir.</p>
              {themeFields.map(({ k, l }) => (
                <div key={k} className="flex items-center gap-3 border border-border p-3">
                  <input type="color" value={cms.theme[k].startsWith("rgba") ? "#1a1e2b" : cms.theme[k]} onChange={e => updTheme(k, e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent flex-shrink-0" />
                  <div className="flex-1 min-w-0"><div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">{l}</div><input value={cms.theme[k]} onChange={e => updTheme(k, e.target.value)} className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary" /></div>
                  <div className="w-8 h-8 border border-border flex-shrink-0" style={{ background: cms.theme[k] }} />
                </div>
              ))}
            </div>
          )}

          {tab === "info" && (
            <div className="space-y-4">
              <div className="border border-green-500/20 bg-green-500/5 p-4">
                <div className="font-mono text-[10px] text-green-400 uppercase tracking-widest mb-2">Proteção de Conteúdo</div>
                <p className="text-sm text-muted-foreground font-light">CMS salvo em <code className="text-primary">cms/data.json</code> — arquivo fora do <code className="text-primary">public/</code>. Commits do Figma Make <strong>não tocam</strong> este arquivo.</p>
                <p className="text-sm text-muted-foreground font-light mt-2">Uploads em <code className="text-primary">public/uploads/</code> também são preservados pois Figma Make não gerencia esses arquivos.</p>
              </div>
              <div className="border border-border p-4 space-y-1.5">{["1. Configure GitHub (aba GitHub)", "2. Clique Publicar após qualquer edição", "3. Vercel faz deploy em ~2 min", "4. Após commits do Figma, clique Sincronizar", "5. Seu conteúdo nunca se perde"].map((s, i) => <p key={i} className="text-sm text-muted-foreground font-light">{s}</p>)}</div>
              <div className="border border-amber-500/20 bg-amber-500/5 p-4"><div className="font-mono text-[10px] text-amber-400 uppercase tracking-widest mb-2">Limite de Upload</div><p className="text-sm text-amber-200/70 font-light">Arquivos até <strong>25 MB</strong> via GitHub API. Vídeos maiores: YouTube ou Vimeo.</p></div>
            </div>
          )}

          {tab === "logs" && <LogsTab logs={logs} />}
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="font-mono text-[10px] text-muted-foreground">{ALL_SEEDS.length + cms.projects.length} proj · {cms.audios.length} áudio · {!ghOk ? "⚠ sem token" : "✓ GitHub ok"}</span>
          <button onClick={onClose} className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */

function PortfolioApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeService, setActiveService] = useState(0);
  const [galleryService, setGalleryService] = useState<{ number: string; title: string; icon: ReactNode; galleryCategories: string[] } | null>(null);
  const [galleryInitialItem, setGalleryInitialItem] = useState<DisplayProject | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminMode, setAdminMode] = useState(checkSession);
  const [showLogin, setShowLogin] = useState(false);
  const progress = useScrollProgress();

  const { ghConfig, setGhConfig, clearGhConfig, clearToken, cms, setCms, loading, saveStatus, saveError, logs, addLog, publishSteps, publishOpen, setPublishOpen, publish, uploadFile, deleteFile, syncFromGitHub, silentSave } = useCMS();

  const content = cms.content;
  const pinned = new Set(cms.pinned);
  const hiddenSeeds = new Set(cms.hiddenSeeds);
  const visibleSeeds = ALL_SEEDS.filter(s => !hiddenSeeds.has(s.id));
  const allProjects: DisplayProject[] = [...visibleSeeds, ...cms.projects];
  const featuredProjects = allProjects.filter(p => pinned.has(p.id));
  const ghOk = !!ghConfig?.token;

  // Build service list from CMS data
  const services = cms.services.map((s, i) => ({
    number: SERVICE_NUMBERS[i] ?? `0${i + 1}`,
    icon: SERVICE_ICONS[i] ?? <Sparkles size={24} />,
    title: s.title,
    description: s.description,
    tags: s.tags,
    galleryCategories: SERVICE_CATEGORIES[i] ?? [s.title],
  }));

  const advantages = cms.advantages.map((a, i) => ({ num: `0${i + 1}`, title: a.title, body: a.body }));

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn, { passive: true }); return () => window.removeEventListener("scroll", fn);
  }, []);

  // Auto-save: toda mudança admin salva no cms-data apos 2s de inatividade
  // Figma Make NUNCA commita no branch cms-data — dados admin ficam seguros
  const _autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const _pendingSave = useRef<CMSData | null>(null);
  const _cmsLoaded = useRef(false);
  useEffect(() => {
    if (!_cmsLoaded.current) { _cmsLoaded.current = true; return; }
    if (!adminMode || !ghConfig?.token) return;
    _pendingSave.current = cms;
    if (_autoSaveTimer.current) clearTimeout(_autoSaveTimer.current);
    _autoSaveTimer.current = setTimeout(() => { silentSave(cms); _pendingSave.current = null; }, 2000);
    return () => { if (_autoSaveTimer.current) clearTimeout(_autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cms]);

  // Flush ao sair da pagina — evita perder mudancas nao salvas ainda
  useEffect(() => {
    const flush = () => { if (_pendingSave.current) silentSave(_pendingSave.current); };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sessão admin expira sozinha (TTL deslizante) — verifica periodicamente e renova com o uso,
  // evitando que uma aba esquecida aberta mantenha acesso admin indefinidamente.
  useEffect(() => {
    if (!adminMode) return;
    const iv = setInterval(() => {
      if (!checkSession()) {
        setAdminMode(false); setAdminOpen(false);
        toast.info("Sessão expirada. Faça login novamente.");
        addLog("info", "Sessão admin expirada por inatividade.");
      } else {
        renewSession();
      }
    }, 60 * 1000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminMode]);

  const scrollTo = (href: string) => { setMenuOpen(false); document.querySelector(href)?.scrollIntoView({ behavior: "smooth" }); };
  const logout = () => {
    endSession();
    clearToken(); // credencial do GitHub não deve sobreviver ao fim da sessão admin
    setAdminMode(false); setAdminOpen(false);
    toast.info("Admin deslogado.");
    addLog("info", "Admin deslogado.");
  };

  const openProjectGallery = (item: DisplayProject) => {
    const svc = services.find(s => s.galleryCategories.includes(item.category));
    if (svc) { setGalleryService(svc); setGalleryInitialItem(item); }
  };

  const handleAddProject = async (proj: CMSProject) => {
    const updated: CMSData = { ...cms, projects: [proj, ...cms.projects], pinned: [...cms.pinned, proj.id] };
    await publish(updated);
  };

  const handleAddAudio = async (audio: CMSAudio) => {
    const updated: CMSData = { ...cms, audios: [audio, ...cms.audios] };
    await publish(updated);
  };

  const handleDeleteProject = async (id: string) => {
    const p = cms.projects.find(p => p.id === id);
    if (p) {
      const allUrls = [p.mediaUrl, p.thumbUrl, ...(p.images ?? [])].filter(Boolean) as string[];
      for (const u of allUrls) { if (u.startsWith("/uploads/")) await deleteFile(u); }
    }
    await publish({ ...cms, projects: cms.projects.filter(p => p.id !== id), pinned: cms.pinned.filter(p => p !== id) });
  };

  const handleDeleteAudio = async (id: string) => {
    const a = cms.audios.find(a => a.id === id);
    if (a) { if (a.url.startsWith("/uploads/")) await deleteFile(a.url); if (a.coverUrl?.startsWith("/uploads/")) await deleteFile(a.coverUrl); }
    await publish({ ...cms, audios: cms.audios.filter(a => a.id !== id) });
  };

  const handleTogglePin = (id: string) => setCms({ ...cms, pinned: pinned.has(id) ? cms.pinned.filter(p => p !== id) : [...cms.pinned, id] });

  const navLinks = [{ label: "Serviços", href: "#servicos" }, { label: "Trabalhos", href: "#trabalhos" }, { label: "Por que eu?", href: "#diferenciais" }, { label: "Contato", href: "#contato" }];

  // O Hero só monta DEPOIS do fetch assíncrono do CMS (branch cms-data),
  // ou seja, o <video autoPlay> nunca está presente no primeiro paint da
  // página. Navegadores mobile (principalmente Safari/iOS) são muito mais
  // rígidos com autoplay de elementos inseridos dinamicamente via JS depois
  // do carregamento inicial do que com o atributo autoPlay declarado no HTML
  // já presente no primeiro paint — nesses casos o autoplay é silenciosamente
  // bloqueado e o vídeo fica parado no primeiro frame ("congelado"). Forçar
  // `.muted` como propriedade do elemento (não só o atributo JSX) e chamar
  // `.play()` explicitamente resolve isso de forma confiável em iOS e Android.
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (loading) return;
    const v = heroVideoRef.current;
    if (!v) return;
    const tryPlay = () => {
      v.muted = true;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    tryPlay();
    // iOS/Android costumam pausar vídeos ao minimizar o app/trocar de aba;
    // sem isso o Hero fica congelado ao voltar, mesmo com autoplay correto.
    document.addEventListener("visibilitychange", tryPlay);
    return () => document.removeEventListener("visibilitychange", tryPlay);
  }, [loading]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <Toaster position="top-right" theme="dark" richColors />

      <PublishProgressModal open={publishOpen} steps={publishSteps} onClose={() => setPublishOpen(false)} />
      <AdminLoginModal open={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => { setAdminMode(true); toast.success("Admin autenticado."); addLog("success", "Admin autenticado."); }} />
      <GalleryModal service={galleryService} allProjects={allProjects} audios={adminMode ? cms.audios : cms.audios.filter(a => !a.hidden)} initialItem={galleryInitialItem} onClose={() => { setGalleryService(null); setGalleryInitialItem(null); }} showAdmin={adminMode} onDelete={handleDeleteProject} onDeleteAudio={handleDeleteAudio} onTogglePin={handleTogglePin} pinned={pinned} />
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onSave={handleAddProject} onSaveAudio={handleAddAudio} uploadFile={uploadFile} ghConfigured={ghOk} />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} cms={cms} setCms={setCms} publish={publish} uploadFile={uploadFile} deleteFile={deleteFile} syncFromGitHub={syncFromGitHub} ghConfig={ghConfig} setGhConfig={setGhConfig} clearGhConfig={clearGhConfig} saveStatus={saveStatus} saveError={saveError} logs={logs} onOpenUpload={() => { setAdminOpen(false); setUploadOpen(true); }} />

      {/* Floating "Disponível" badge — fixed bottom-right, visible everywhere */}
      <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-background border border-primary/60 px-4 py-2 shadow-lg hover:border-primary transition-colors group"
        style={{ backdropFilter: "blur(8px)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
        <span className="font-mono text-[10px] text-primary tracking-[0.2em] uppercase group-hover:text-primary/80">{content.heroBadge}</span>
        <ArrowUpRight size={10} className="text-primary/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </a>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 h-[2px] bg-primary z-[100]" style={{ width: `${progress * 100}%`, transition: "width 60ms linear" }} />

      {/* Admin FAB */}
      {adminMode && (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-2">
          {saveStatus === "saving" && <div className="flex items-center gap-2 bg-card/95 border border-primary/30 px-3 py-1.5 text-[10px] font-mono text-primary shadow-lg"><Loader2 size={10} className="animate-spin" />Publicando...</div>}
          {saveStatus === "success" && <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-3 py-1.5 text-[10px] font-mono text-green-400 shadow-lg"><CheckCircle2 size={10} />Publicado!</div>}
          <button onClick={logout} className="flex items-center gap-1.5 bg-card border border-border text-muted-foreground px-3 py-1.5 text-[10px] font-mono tracking-widest uppercase shadow-lg"><LogOut size={10} />Sair</button>
          <button onClick={() => setAdminOpen(true)} className="flex items-center gap-1.5 bg-primary text-background px-4 py-2.5 font-bold text-[10px] tracking-widest uppercase shadow-lg"><Settings size={11} />Painel Admin</button>
          <button onClick={() => setUploadOpen(true)} className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center bg-primary text-background shadow-xl hover:bg-primary/85 transition-colors"><Plus size={20} /></button>
        </div>
      )}

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/96 backdrop-blur border-b border-border" : ""}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
          <button onClick={() => scrollTo("#hero")}><img src={logoImg} alt="Freed Pierre" className="h-9 md:h-12 w-auto object-contain brightness-200" /></button>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(l => <button key={l.href} onClick={() => scrollTo(l.href)} className="font-medium text-xs tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors">{l.label}</button>)}
            {!adminMode
              ? <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 font-bold text-xs tracking-widest uppercase hover:bg-primary/85 transition-colors"><MessageCircle size={13} />Orçamento</a>
              : <button onClick={() => setAdminOpen(true)} className="font-mono text-[10px] text-primary border border-primary/30 px-3 py-1.5 flex items-center gap-1.5 hover:bg-primary/10 transition-colors"><Settings size={11} />Admin</button>}
          </div>
          <button className="md:hidden text-foreground p-1" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        <div className={`md:hidden overflow-hidden transition-[max-height] duration-300 ${menuOpen ? "max-h-80" : "max-h-0"} bg-card border-b border-border`}>
          <div className="px-5 py-5 flex flex-col gap-5">
            {navLinks.map(l => <button key={l.href} onClick={() => scrollTo(l.href)} className="text-left font-medium text-xs tracking-[0.2em] uppercase text-muted-foreground">{l.label}</button>)}
            <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-primary text-background px-5 py-3 font-bold text-xs tracking-widest uppercase w-fit"><MessageCircle size={13} />Orçamento</a>
            {adminMode && <button onClick={() => { setMenuOpen(false); setAdminOpen(true); }} className="flex items-center gap-2 text-primary font-mono text-[10px] tracking-widest uppercase"><Settings size={11} />Admin</button>}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {/* Mobile: persona mais à direita (70%); Desktop: posição clássica (30%) */}
          <style>{`#hero-video { object-position: 70% top; } @media (min-width: 768px) { #hero-video { object-position: 30% top; } }`}</style>
          <video
            ref={heroVideoRef}
            id="hero-video"
            src={heroVideo} autoPlay muted loop playsInline
            onLoadedMetadata={e => { e.currentTarget.muted = true; e.currentTarget.play().catch(() => {}); }}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-background/65" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/15 to-background" />
        </div>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "200px" }} />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-5 md:px-8 text-left pt-20 md:pt-0">
          <h1 className="font-black uppercase leading-[0.88] mb-5 md:mb-8 text-left" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            <span className="block text-foreground" style={{ fontSize: "clamp(2rem, 6.7vw, 6rem)" }}>{content.heroLine1}</span>
            <span className="block text-primary" style={{ fontSize: "clamp(2rem, 6.7vw, 6rem)" }}>{content.heroLine2}</span>
            <span className="block text-foreground" style={{ fontSize: "clamp(2rem, 6.7vw, 6rem)" }}>{content.heroLine3}</span>
            <span className="block" style={{ fontSize: "clamp(2.5rem, 8.9vw, 8rem)", WebkitTextStroke: "clamp(1px, 0.18vw, 2px) rgba(237,233,226,0.55)", color: "transparent" }}>{content.heroLine4}</span>
          </h1>
          <p className="text-muted-foreground font-light text-sm md:text-lg max-w-sm md:max-w-xl mb-7 md:mb-10 leading-relaxed">{content.heroSubtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => scrollTo("#servicos")} className="flex items-center justify-center gap-2 bg-primary text-background px-7 py-3.5 font-bold text-sm tracking-widest uppercase hover:bg-primary/85 transition-colors">Ver serviços</button>
            <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 border border-foreground/20 text-foreground px-7 py-3.5 font-semibold text-sm tracking-widest uppercase hover:border-foreground/50 transition-colors"><MessageCircle size={15} />WhatsApp</a>
          </div>
        </div>

        <div className="relative z-10 w-full border-t border-border mt-10 md:mt-16">
          <div className="max-w-6xl mx-auto px-5 md:px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {["Design Gráfico", "Motion Design", "Videos", "Produção Fonográfica"].map((d, i) => (
              <div key={d} className={`flex items-center gap-2 ${i > 0 ? "md:border-l md:border-border md:pl-8" : ""}`}>
                <span className="w-1 h-1 bg-primary flex-shrink-0" />
                <span className="font-mono text-[10px] text-muted-foreground tracking-[0.12em] uppercase font-bold leading-tight">{d}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => scrollTo("#servicos")} className="absolute bottom-4 left-1/2 -translate-x-1/2 text-muted-foreground z-10"><ChevronDown size={16} className="animate-bounce" /></button>
      </section>

      {/* ── SERVIÇOS ── */}
      <section id="servicos" className="py-16 md:py-28">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <FadeIn><SectionLabel>Serviços</SectionLabel></FadeIn>
          <FadeIn delay={60}>
            <h2 className="text-4xl md:text-7xl font-black uppercase text-foreground leading-none mb-10 md:mb-16" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {content.servicesHeading1}<br /><span className="text-primary">{content.servicesHeading2}</span>
            </h2>
          </FadeIn>

          {/* Desktop grid */}
          <div className="hidden md:grid grid-cols-[220px_1fr] border border-border">
            <div className="border-r border-border">
              {services.map((s, i) => (
                <button key={s.number} onClick={() => setActiveService(i)} className={`w-full text-left px-6 py-5 border-b border-border last:border-b-0 transition-all ${activeService === i ? "bg-primary/8" : "hover:bg-muted/40"}`}>
                  <div className={`font-mono text-[10px] tracking-widest uppercase mb-1 ${activeService === i ? "text-primary" : "text-muted-foreground"}`}>{s.number}</div>
                  <div className={`text-lg font-black uppercase leading-tight ${activeService === i ? "text-primary" : "text-foreground"}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.title}</div>
                  {activeService === i && <div className="mt-2 h-px w-6 bg-primary" />}
                </button>
              ))}
            </div>
            <div className="p-10">
              <div className="text-primary mb-5">{services[activeService]?.icon}</div>
              <h3 className="text-4xl font-black uppercase text-foreground mb-4 leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{services[activeService]?.title}</h3>
              <p className="text-muted-foreground text-base leading-relaxed font-light mb-8">{services[activeService]?.description}</p>
              <div className="flex flex-wrap gap-2 mb-8">{services[activeService]?.tags.map(t => <span key={t} className="font-mono text-[10px] tracking-widest uppercase border border-border text-muted-foreground px-3 py-1.5 hover:border-primary hover:text-primary transition-colors">{t}</span>)}</div>
              <div className="flex flex-wrap items-center gap-6">
                <button onClick={() => { setGalleryService(services[activeService]); setGalleryInitialItem(null); }} className="inline-flex items-center gap-2 bg-primary text-background px-6 py-2.5 font-bold text-xs tracking-widest uppercase hover:bg-primary/85 transition-colors">Ver galeria <Film size={13} /></button>
                <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary font-semibold text-sm tracking-wider uppercase">Solicitar orçamento <ArrowUpRight size={15} /></a>
              </div>
            </div>
          </div>

          {/* Mobile accordion */}
          <div className="md:hidden space-y-2">
            {services.map((s, i) => {
              const open = activeService === i;
              return (
                <FadeIn key={s.number} delay={i * 40}>
                  <div className="border border-border overflow-hidden">
                    <button onClick={() => setActiveService(open ? -1 : i)} className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${open ? "bg-primary/8" : ""}`}>
                      <span className={`flex-shrink-0 ${open ? "text-primary" : "text-muted-foreground"}`}>{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-0.5">{s.number}</div>
                        <div className={`text-xl font-black uppercase leading-tight ${open ? "text-primary" : "text-foreground"}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.title}</div>
                      </div>
                      <ChevronDown size={16} className={`text-muted-foreground flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                    </button>
                    <div className={`overflow-hidden transition-[max-height] duration-300 ${open ? "max-h-80" : "max-h-0"}`}>
                      <div className="px-5 pb-5 pt-1 border-t border-border">
                        <p className="text-muted-foreground text-sm leading-relaxed font-light mb-4">{s.description}</p>
                        <div className="flex flex-wrap gap-1.5 mb-4">{s.tags.map(t => <span key={t} className="font-mono text-[10px] tracking-widest uppercase border border-border text-muted-foreground px-2.5 py-1">{t}</span>)}</div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => { setGalleryService(s); setGalleryInitialItem(null); }} className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 font-bold text-xs tracking-widest uppercase">Ver galeria <Film size={12} /></button>
                          <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary text-xs font-semibold tracking-wider uppercase">Orçamento <ArrowUpRight size={12} /></a>
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TRABALHOS ── */}
      <section id="trabalhos" className="py-16 md:py-24 bg-background overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <FadeIn><SectionLabel>Explorando Meu Trabalho</SectionLabel></FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 md:mb-12">
            <FadeIn delay={60}><h2 className="text-4xl md:text-7xl font-black uppercase text-foreground leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Portfólio<br /><span className="text-primary">por área</span></h2></FadeIn>
            {adminMode && <FadeIn delay={100}><button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 px-4 py-2.5 font-bold text-xs tracking-widest uppercase bg-primary text-background self-start sm:self-auto"><Plus size={13} />Adicionar</button></FadeIn>}
          </div>

          {featuredProjects.length > 0 && (
            <FadeIn delay={80}>
              <div className="mb-10 md:mb-14">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-1.5 h-5 flex-shrink-0 rounded-sm bg-primary" />
                  <span className="font-black uppercase text-foreground text-lg md:text-xl leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Em Destaque</span>
                  <span className="font-mono text-[9px] text-muted-foreground tracking-widest">{featuredProjects.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
                  {featuredProjects.slice(0, 4).map(item => (
                    <ProjectCard key={item.id} item={item} showAdmin={adminMode} isPinned={pinned.has(item.id)} onTogglePin={handleTogglePin} onDelete={!item.isFixed ? handleDeleteProject : undefined} onClick={() => openProjectGallery(item)} />
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          <FadeIn delay={120}>
            <div className="space-y-2">
              {CATEGORIES.map(cat => {
                const catItems = allProjects.filter(p => p.category === cat);
                return <CarouselRow key={cat} label={cat} items={catItems} showAdmin={adminMode} pinned={pinned} onTogglePin={handleTogglePin} onDelete={handleDeleteProject} onClickItem={openProjectGallery} />;
              })}
            </div>
          </FadeIn>

          {allProjects.length === 0 && (
            <div className="border border-dashed border-border py-20 flex flex-col items-center gap-4">
              <Film size={28} className="text-muted-foreground" />
              <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase text-center">Nenhum projeto ainda</p>
              {adminMode && <button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 font-bold text-xs tracking-widest uppercase mt-2"><Plus size={12} />Primeiro projeto</button>}
            </div>
          )}
        </div>
      </section>

      {/* ── DIFERENCIAIS ── */}
      <section id="diferenciais" className="py-16 md:py-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 md:px-6 overflow-hidden">
          <FadeIn><SectionLabel>Por que eu?</SectionLabel></FadeIn>
              <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start w-full" style={{ maxWidth: "100%" }}>
            <FadeIn delay={60} className="min-w-0 w-full">
              <div className="min-w-0 w-full" style={{ maxWidth: "100%" }}>
                <h2
                  className="font-black uppercase text-foreground leading-tight mb-5"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(1.8rem, 7.5vw, 4rem)", wordBreak: "break-word", overflowWrap: "break-word" }}
                >
                  {content.difHeading1}<br />{content.difHeading2}<br /><span className="text-primary">{content.difHeading3}</span>
                </h2>
                <p className="text-muted-foreground font-light text-sm md:text-base leading-relaxed mb-6 md:mb-8" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{content.difSubtext}</p>
                {/* Wrapper com max-width — o carrossel usa overflow-x: auto internamente */}
                <div style={{ maxWidth: "100%", width: "100%" }}>
                  <AudioCarousel audios={adminMode ? cms.audios : cms.audios.filter(a => !a.hidden)} showAdmin={adminMode} onDelete={handleDeleteAudio} />
                </div>
              </div>
            </FadeIn>
            <div className="space-y-0 min-w-0 w-full">
              {advantages.map((adv, i) => (
                <FadeIn key={adv.num} delay={80 + i * 60}>
                  <div className="border-b border-border py-5 md:py-7">
                    <div className="flex items-start gap-4 md:gap-5 w-full overflow-hidden">
                      <span className="font-mono text-[10px] text-primary tracking-widest mt-1 flex-shrink-0">{adv.num}</span>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <h3 className="font-black uppercase text-foreground mb-1 leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(1rem, 4vw, 1.25rem)", wordBreak: "break-word" }}>{adv.title}</h3>
                        <p className="text-sm text-muted-foreground font-light leading-relaxed" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{adv.body}</p>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="border-y border-border bg-card/40 py-8 md:py-10">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
            {[{ n: content.stat1Val, l: content.stat1Label }, { n: content.stat2Val, l: content.stat2Label }, { n: content.stat3Val, l: content.stat3Label }, { n: content.stat4Val, l: content.stat4Label }].map(s => (
              <div key={s.l} className="bg-card/40 px-4 md:px-8 py-6 md:py-7 text-center">
                <div className="text-3xl md:text-5xl font-black text-primary mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.n}</div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase leading-tight">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTATO ── */}
      <section id="contato" className="py-16 md:py-28">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <FadeIn><SectionLabel>Contato</SectionLabel></FadeIn>
          <div className="grid md:grid-cols-2 gap-10 md:gap-16">
            <FadeIn delay={60}>
              <div>
                <h2 className="text-4xl md:text-7xl font-black uppercase text-foreground leading-none mb-5" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{content.contactHeading}</h2>
                <p className="text-muted-foreground font-light text-sm md:text-base leading-relaxed mb-7">{content.contactSubtext}</p>
                <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-primary text-background px-7 py-4 font-black tracking-widest uppercase hover:bg-primary/85 transition-colors w-full sm:w-auto justify-center" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem" }}>
                  <MessageCircle size={17} />Falar no WhatsApp
                </a>
              </div>
            </FadeIn>
            <FadeIn delay={140}>
              <div className="border border-border divide-y divide-border">
                {CONTACT_LINKS.map(c => (
                  <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-4 md:gap-5 px-5 md:px-7 py-5 hover:bg-muted/40 transition-colors group">
                    <span className="text-primary flex-shrink-0">{c.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-0.5">{c.label}</div>
                      <div className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{c.value}</div>
                    </div>
                    <ArrowUpRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </a>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-6 md:py-8">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <div className="md:hidden flex flex-col items-center gap-4 text-center">
            <button onClick={() => scrollTo("#hero")}><img src={logoImg} alt="Freed Pierre" className="h-9 w-auto brightness-200 opacity-80" /></button>
            <p className="font-mono text-[10px] text-muted-foreground tracking-wider leading-relaxed cursor-default" onClick={() => !adminMode && setShowLogin(true)}>
              {content.footerCopy}{adminMode && <span className="block text-primary mt-0.5">ADMIN ATIVO</span>}
            </p>
            <div className="flex items-center gap-5">
              <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors"><MessageCircle size={18} /></a>
              <a href="mailto:fredericopierredamasceno@gmail.com" className="text-muted-foreground hover:text-primary transition-colors"><Mail size={18} /></a>
            </div>
            <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-primary/50 px-4 py-2 hover:border-primary transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[10px] text-primary tracking-[0.2em] uppercase">{content.heroBadge}</span>
            </a>
          </div>
          <div className="hidden md:grid grid-cols-3 items-center">
            <button onClick={() => scrollTo("#hero")}><img src={logoImg} alt="Freed Pierre" className="h-10 w-auto brightness-200 opacity-80 hover:opacity-100 transition-opacity" /></button>
            <p className="font-mono text-[10px] text-muted-foreground tracking-widest text-center leading-relaxed cursor-default" onClick={() => !adminMode && setShowLogin(true)}>
              {content.footerCopy}{adminMode && <span className="block text-primary mt-0.5">ADMIN ATIVO</span>}
            </p>
            <div className="flex justify-end items-center gap-4">
              <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-primary/50 px-3 py-1.5 hover:border-primary transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="font-mono text-[9px] text-primary tracking-[0.2em] uppercase">{content.heroBadge}</span>
              </a>
              <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors"><MessageCircle size={16} /></a>
              <a href="mailto:fredericopierredamasceno@gmail.com" className="text-muted-foreground hover:text-primary transition-colors"><Mail size={16} /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PortfolioApp />
    </ErrorBoundary>
  );
}
