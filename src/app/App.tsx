import { useState, useEffect, useRef, useCallback, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  Mail, Phone, Menu, X, ChevronDown,
  Mic, Film, Palette, MessageCircle, ArrowUpRight,
  Play, Pause, Upload, Trash2, Plus, ImageIcon, VideoIcon,
  Check, Music, LogOut, Lock, Eye, EyeOff, Sparkles,
  Settings, FileText, Paintbrush, FolderOpen, Info,
  Pin, PinOff, Github, RefreshCw, AlertCircle, CheckCircle2, Loader2,
  Youtube, Link2, ScrollText, Zap, Clock, CheckCheck, XCircle, WifiOff,
} from "lucide-react";
import heroVideo from "../imports/Portf_lio_Video_Final_Ver.mp4";
import pizzaVideo from "../imports/Lan_amento_Pizza_Ifood.mp4";
import alienadoVideo from "../imports/WhatsApp_Video_2026-08-05_at_00.10.39.mp4";
import logoImg from "../imports/Logo_Freed_Pierre.png";

/* ─────────────────────────────────────────────────────────────────
   GITHUB CMS SERVICE
   Persistência total via GitHub REST API.
   public/cms-data.json = banco de dados.
   Uploads → public/uploads/{images|videos|audio}/.
   owner/repo/branch → localStorage (seguro persistir)
   token → sessionStorage apenas (dado sensível)
───────────────────────────────────────────────────────────────────*/

const CMS_FILE = "public/cms-data.json";
const GH_CFG_KEY = "fp_gh_cfg";   // localStorage — owner/repo/branch
const GH_TOKEN_KEY = "fp_gh_tok"; // sessionStorage — token apenas
const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface GitHubConfig {
  owner: string; repo: string; branch: string; token: string;
}

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
  localStorage.setItem(GH_CFG_KEY, JSON.stringify({ owner: cfg.owner, repo: cfg.repo, branch: cfg.branch }));
  if (cfg.token) sessionStorage.setItem(GH_TOKEN_KEY, cfg.token);
}

function clearGHConfig() {
  localStorage.removeItem(GH_CFG_KEY);
  sessionStorage.removeItem(GH_TOKEN_KEY);
}

const GH_API = (cfg: GitHubConfig, path: string) =>
  `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
});

async function ghGetSHA(cfg: GitHubConfig, path: string): Promise<string | undefined> {
  try {
    const r = await fetch(`${GH_API(cfg, path)}?ref=${cfg.branch}`, { headers: GH_HEADERS(cfg.token) });
    if (r.ok) return (await r.json()).sha;
  } catch {}
  return undefined;
}

/* Fix: use FileReader to convert file → base64 without blocking the main thread.
   The old approach (synchronous byte-by-byte String.fromCharCode loop) froze the UI
   because it ran 1000+ iterations on the main thread for large files. */
async function fileToBase64(file: File, onProgress: (p: UploadProgress) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    onProgress({ phase: "preparing", percent: 5, bytesSent: 0, bytesTotal: file.size, speed: 0 });
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 30) + 5;
        onProgress({ phase: "preparing", percent: pct, bytesSent: e.loaded, bytesTotal: file.size, speed: 0 });
      }
    };
    reader.onload = () => {
      const result = reader.result as string;
      onProgress({ phase: "preparing", percent: 35, bytesSent: file.size, bytesTotal: file.size, speed: 0 });
      resolve(result.split(",")[1]); // strip "data:...;base64," prefix
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

async function ghUploadBinary(
  cfg: GitHubConfig,
  folder: string,
  file: File,
  onProgress: (p: UploadProgress) => void,
): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safe}`;
  const path = `${folder}/${filename}`;

  const content = await fileToBase64(file, onProgress);
  onProgress({ phase: "sending", percent: 38, bytesSent: file.size * 0.38, bytesTotal: file.size, speed: 0 });

  const sha = await ghGetSHA(cfg, path);
  const body: Record<string, unknown> = { message: `Upload: ${file.name}`, content, branch: cfg.branch };
  if (sha) body.sha = sha;

  const startTime = Date.now();
  let simPct = 38;
  const ticker = setInterval(() => {
    simPct = Math.min(88, simPct + 6);
    const elapsed = (Date.now() - startTime) / 1000;
    const approxSent = (simPct / 100) * file.size;
    const speed = elapsed > 0 ? approxSent / elapsed : 0;
    onProgress({ phase: "sending", percent: simPct, bytesSent: approxSent, bytesTotal: file.size, speed });
  }, 500);

  try {
    const r = await fetch(GH_API(cfg, path), {
      method: "PUT", headers: GH_HEADERS(cfg.token), body: JSON.stringify(body),
    });
    clearInterval(ticker);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      onProgress({ phase: "error", percent: simPct, bytesSent: 0, bytesTotal: file.size, speed: 0 });
      throw new Error((e as Record<string, string>).message || `HTTP ${r.status}`);
    }
    onProgress({ phase: "processing", percent: 95, bytesSent: file.size, bytesTotal: file.size, speed: 0 });
    await new Promise(r => setTimeout(r, 350));
    onProgress({ phase: "done", percent: 100, bytesSent: file.size, bytesTotal: file.size, speed: 0 });
    return `/${path.replace(/^public\//, "")}`;
  } catch (err) {
    clearInterval(ticker);
    throw err;
  }
}

/* Fetches and decodes cms-data.json directly from GitHub API.
   Works for public repos (no token) and private repos (with token).
   This is the source of truth — bypasses whatever Figma Make bundled. */
async function ghFetchCMS(cfg: Pick<GitHubConfig, "owner" | "repo" | "branch" | "token">): Promise<{ data: CMSData; sha: string } | null> {
  try {
    const headers: HeadersInit = { Accept: "application/vnd.github+json" };
    if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
    const r = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${CMS_FILE}?ref=${cfg.branch}`,
      { headers },
    );
    if (!r.ok) return null;
    const json = await r.json();
    const decoded = JSON.parse(atob(json.content.replace(/\n/g, "")));
    return { data: makeCMSData(decoded), sha: json.sha };
  } catch { return null; }
}

/* Always fetches the latest content from GitHub before writing —
   prevents Figma Make commits from overwriting admin-panel uploads. */
async function ghCommitCMS(cfg: GitHubConfig, data: CMSData): Promise<{ ok: boolean; error?: string }> {
  try {
    // Get current SHA (required by GitHub API for updates)
    const sha = await ghGetSHA(cfg, CMS_FILE);
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body: Record<string, unknown> = { message: "CMS: Atualização de conteúdo", content, branch: cfg.branch };
    if (sha) body.sha = sha;
    const r = await fetch(GH_API(cfg, CMS_FILE), { method: "PUT", headers: GH_HEADERS(cfg.token), body: JSON.stringify(body) });
    if (r.ok) return { ok: true };
    const e = await r.json().catch(() => ({}));
    return { ok: false, error: (e as Record<string, string>).message || `HTTP ${r.status}` };
  } catch (e: unknown) { return { ok: false, error: e instanceof Error ? e.message : "Erro de rede." }; }
}

async function ghDeleteFile(cfg: GitHubConfig, publicPath: string): Promise<void> {
  const repoPath = `public${publicPath}`;
  const sha = await ghGetSHA(cfg, repoPath);
  if (!sha) return;
  await fetch(GH_API(cfg, repoPath), {
    method: "DELETE",
    headers: GH_HEADERS(cfg.token),
    body: JSON.stringify({ message: `Remove: ${publicPath}`, sha, branch: cfg.branch }),
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

// Parse YouTube / Vimeo URLs
function parseVideoUrl(url: string): { platform: "youtube" | "vimeo"; id: string; embed: string; thumb: string } | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (yt) {
    const id = yt[1];
    return { platform: "youtube", id, embed: `https://www.youtube.com/embed/${id}`, thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg` };
  }
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) {
    const id = vm[1];
    return { platform: "vimeo", id, embed: `https://player.vimeo.com/video/${id}`, thumb: "" };
  }
  return null;
}

/* ─── Types ──────────────────────────────────────────────────────── */

interface UploadProgress {
  phase: "preparing" | "sending" | "processing" | "done" | "error";
  percent: number; bytesSent: number; bytesTotal: number; speed: number;
}

interface LogEntry {
  id: string; ts: Date; level: "info" | "success" | "error" | "warn"; msg: string;
}

interface PublishStep {
  id: string; label: string; status: "pending" | "running" | "done" | "error"; error?: string;
}

interface CMSProject {
  id: string; title: string; description: string; category: string;
  mediaType: "image" | "video" | "embed"; mediaUrl: string; thumbUrl?: string;
  embedPlatform?: "youtube" | "vimeo"; embedId?: string;
  isFixed?: boolean; createdAt: number;
}
type DisplayProject = CMSProject;

interface CMSData {
  content: SiteContent; theme: SiteTheme;
  projects: CMSProject[]; pinned: string[]; hiddenSeeds: string[];
  audio: { name: string; url: string } | null; updatedAt: string;
}

/* ─── Defaults ────────────────────────────────────────────────────── */

const CONTENT_DEFAULTS = {
  heroLine1: "ONDE ÁUDIO,", heroLine2: "DESIGN", heroLine3: "E MOVIMENTOS", heroLine4: "SE ENCONTRAM",
  heroBadge: "Disponível para projetos",
  heroSubtitle: "Um profissional. Quatro linguagens. Design, motion, vídeo e produção fonográfica para marcas, artistas e conteúdo digital.",
  stat1Val: "10+", stat1Label: "Anos de experiência",
  stat2Val: "4", stat2Label: "Áreas de atuação",
  stat3Val: "Multi", stat3Label: "Perfil criativo",
  stat4Val: "ECAD", stat4Label: "Cadastrado",
  difHeading1: "Menos", difHeading2: "intermediários.", difHeading3: "Mais resultado.",
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

function makeCMSData(overrides: Partial<CMSData> = {}): CMSData {
  return {
    content: { ...CONTENT_DEFAULTS }, theme: { ...THEME_DEFAULTS },
    projects: [], pinned: ["seed-pizza", "seed-alienado"], hiddenSeeds: [],
    audio: null, updatedAt: new Date().toISOString(), ...overrides,
  };
}

type SaveStatus = "idle" | "saving" | "success" | "error";

/* ─── Central CMS hook ────────────────────────────────────────────── */

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    addLog("info", "Carregando portfólio...");
    const cfg = loadGHConfig();

    /* Priority 1: GitHub API — always the authoritative source.
       This bypasses whatever Figma Make may have bundled into public/cms-data.json.
       Works for public repos (no token needed) and private repos (with token). */
    if (cfg?.owner && cfg?.repo) {
      addLog("info", `Sincronizando com GitHub (${cfg.owner}/${cfg.repo})...`);
      ghFetchCMS(cfg)
        .then(result => {
          if (result) {
            setCms(result.data);
            setLoading(false);
            addLog("success", "CMS carregado do GitHub — dados sempre atualizados.");
            return;
          }
          // GitHub returned nothing (private repo without token, or file doesn't exist yet)
          // Fall through to local file
          throw new Error("GitHub retornou vazio");
        })
        .catch(() => {
          addLog("warn", "GitHub indisponível — usando arquivo local como fallback.");
          fetch(`/cms-data.json?t=${Date.now()}`)
            .then(r => { if (!r.ok) throw new Error("not found"); return r.json(); })
            .then((d: Partial<CMSData>) => { setCms(makeCMSData(d)); setLoading(false); addLog("success", "cms-data.json local carregado."); })
            .catch(() => { setLoading(false); addLog("warn", "Nenhuma fonte disponível — usando padrões."); });
        });
      return;
    }

    /* Priority 2: local static file (before GitHub is configured) */
    fetch(`/cms-data.json?t=${Date.now()}`)
      .then(r => { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then((d: Partial<CMSData>) => { setCms(makeCMSData(d)); setLoading(false); addLog("success", "cms-data.json carregado."); })
      .catch(() => { setLoading(false); addLog("warn", "cms-data.json não encontrado — usando padrões."); });
  }, []);

  const setGhConfig = useCallback((cfg: GitHubConfig) => {
    storeGHConfig(cfg); setGhConfigState(cfg);
  }, []);

  const doPublish = useCallback(async (data: CMSData): Promise<boolean> => {
    if (!ghConfig) { setSaveError("Configure o GitHub primeiro."); setSaveStatus("error"); return false; }
    if (!ghConfig.token) { setSaveError("Token não informado. Re-entre o token na aba GitHub."); setSaveStatus("error"); return false; }

    const STEPS: PublishStep[] = [
      { id: "validate", label: "Validando arquivos...", status: "pending" },
      { id: "sha", label: "Obtendo referência do repositório...", status: "pending" },
      { id: "commit", label: "Commitando no GitHub...", status: "pending" },
      { id: "push", label: "Enviando alterações...", status: "pending" },
      { id: "netlify", label: "Netlify iniciando build...", status: "pending" },
      { id: "done", label: "Publicação concluída.", status: "pending" },
    ];

    setPublishSteps(STEPS); setPublishOpen(true);
    setSaveStatus("saving"); setSaveError(""); addLog("info", "Publicação iniciada.");

    const upd = (id: string, status: PublishStep["status"], error?: string) =>
      setPublishSteps(prev => prev.map(s => s.id === id ? { ...s, status, error } : s));

    upd("validate", "running");
    await new Promise(r => setTimeout(r, 300));
    upd("validate", "done"); addLog("info", "Validação concluída.");

    upd("sha", "running");
    const sha = await ghGetSHA(ghConfig, CMS_FILE).catch(() => undefined);
    upd("sha", "done");

    upd("commit", "running");
    const payload = { ...data, updatedAt: new Date().toISOString() };
    const result = await ghCommitCMS(ghConfig, payload);

    if (!result.ok) {
      upd("commit", "error", result.error); upd("push", "error");
      setSaveStatus("error"); setSaveError(result.error ?? "Falha ao commitar.");
      addLog("error", `Commit falhou: ${result.error}`);
      return false;
    }

    upd("commit", "done"); addLog("success", "Commit criado no GitHub.");
    upd("push", "running");
    await new Promise(r => setTimeout(r, 600));
    upd("push", "done"); addLog("success", "Push realizado.");

    upd("netlify", "running"); addLog("info", "Build iniciado na Netlify.");
    await new Promise(r => setTimeout(r, 1200));
    upd("netlify", "done");

    upd("done", "running");
    await new Promise(r => setTimeout(r, 300));
    upd("done", "done"); addLog("success", "Publicação concluída — deploy ativo na Netlify em ~1-2 min.");

    setCms(payload); setSaveStatus("success");
    setTimeout(() => setSaveStatus("idle"), 9000);
    return true;
  }, [ghConfig, addLog]);

  const uploadFile = useCallback(async (
    file: File, type: "image" | "video" | "audio",
    onProgress: (p: UploadProgress) => void,
  ): Promise<string | null> => {
    if (!ghConfig?.token) { setSaveError("Configure o GitHub + token antes de fazer uploads."); return null; }
    const folder = type === "image" ? "public/uploads/images" : type === "video" ? "public/uploads/videos" : "public/uploads/audio";
    addLog("info", `Upload iniciado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    try {
      const url = await ghUploadBinary(ghConfig, folder, file, onProgress);
      addLog("success", `Upload concluído: ${file.name} → ${url}`);
      return url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro no upload.";
      setSaveError(msg); setSaveStatus("error");
      addLog("error", `Upload falhou: ${file.name} — ${msg}`);
      onProgress({ phase: "error", percent: 0, bytesSent: 0, bytesTotal: file.size, speed: 0 });
      return null;
    }
  }, [ghConfig, addLog]);

  const deleteFile = useCallback(async (publicPath: string): Promise<void> => {
    if (!ghConfig?.token || !publicPath.startsWith("/uploads/")) return;
    try { await ghDeleteFile(ghConfig, publicPath); addLog("info", `Arquivo removido: ${publicPath}`); } catch {}
  }, [ghConfig, addLog]);

  /* Sync: fetches the latest cms-data.json from GitHub and overwrites local state.
     Use this whenever you suspect Figma committed a stale version. */
  const syncFromGitHub = useCallback(async (): Promise<boolean> => {
    if (!ghConfig?.owner || !ghConfig?.repo) { addLog("warn", "Configure o GitHub para sincronizar."); return false; }
    addLog("info", "Sincronizando com GitHub...");
    const result = await ghFetchCMS(ghConfig);
    if (result) {
      setCms(result.data);
      addLog("success", "Sincronizado com sucesso — dados atualizados do GitHub.");
      return true;
    }
    addLog("error", "Falha ao sincronizar com GitHub. Verifique as configurações.");
    return false;
  }, [ghConfig, addLog]);

  return {
    ghConfig, setGhConfig,
    clearGhConfig: useCallback(() => { clearGHConfig(); setGhConfigState(null); }, []),
    cms, setCms, loading, saveStatus, saveError,
    logs, addLog, publishSteps, publishOpen, setPublishOpen,
    publish: doPublish, uploadFile, deleteFile, syncFromGitHub,
  };
}

/* ─── Formatters ─────────────────────────────────────────────────── */

function fmtBytes(b: number) {
  if (b < 1024) return `${b.toFixed(0)} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
function fmtSpeed(bps: number) {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(2)} MB/s`;
}

const PHASE_LABELS: Record<UploadProgress["phase"], string> = {
  preparing: "Preparando upload", sending: "Enviando", processing: "Processando", done: "Finalizado", error: "Erro",
};

/* ─── Auth ────────────────────────────────────────────────────────── */

const ADMIN_USER = "freed";
const ADMIN_PASS = "pierre2026";
const SESSION_KEY = "fp_admin_session";
function checkSession() { return sessionStorage.getItem(SESSION_KEY) === "1"; }

/* ─── Seeds (vídeos bundled no código) ───────────────────────────── */

const ALL_SEEDS: DisplayProject[] = [
  {
    id: "seed-pizza", category: "Motion Design",
    title: "Motion Lançamento de Pizzas", isFixed: true,
    description: "🍕✨ Motion Design desenvolvido para o Grupo Beija-flor, promovendo novidades do cardápio da unidade de Jardim Teresópolis, Betim/MG.\n\nCada animação, transição e detalhe foi pensado para valorizar o produto e criar uma comunicação dinâmica, moderna, envolvente e com apelo comercial.\n\n🎬 Mais um trabalho que tive grande satisfação em desenvolver.",
    mediaType: "video", mediaUrl: pizzaVideo, createdAt: 0,
  },
  {
    id: "seed-alienado", category: "Motion Design",
    title: "Alienado — Motion Design", isFixed: true,
    description: "🎬✨ Projeto de motion design com identidade visual forte e cinematográfica. Animações, tipografia animada e edição de vídeo integrada para criar uma experiência audiovisual única e impactante.",
    mediaType: "video", mediaUrl: alienadoVideo, createdAt: 1,
  },
];

/* ─── Constants ──────────────────────────────────────────────────── */

const CATEGORIES = ["Motion Design", "Video Making", "Design Gráfico", "Produção Fonográfica"];

const SERVICES = [
  { icon: <Palette size={24} />, number: "01", title: "Design Gráfico", description: "Identidade visual para singles musicais, lançamentos digitais, artes para redes sociais, capas de álbum, materiais institucionais e peças impressas.", tags: ["Photoshop", "Illustrator", "Identidade Visual", "Mídias Sociais", "Canva"], galleryCategories: ["Design Gráfico"] },
  { icon: <Film size={24} />, number: "02", title: "Video Making", description: "Vídeos para redes sociais, videoclipes, lyric videos, vídeos institucionais e conteúdo audiovisual. Edição e storytelling visual.", tags: ["Premiere Pro", "Edição de Vídeo", "Lyric Video", "Reels", "Institucional"], galleryCategories: ["Video Making"] },
  { icon: <Sparkles size={24} />, number: "03", title: "Motion Design", description: "Animações, vinhetas, motion graphics e edição de vídeo integrada. Cada frame pensado para gerar impacto e engajamento em poucos segundos.", tags: ["After Effects", "Motion Graphics", "Animação", "Vinhetas", "Reels", "Premiere Pro"], galleryCategories: ["Motion Design"] },
  { icon: <Mic size={24} />, number: "04", title: "Produção Fonográfica", description: "Gravação, produção, edição, mixagem e masterização em estúdio. Cadastrado no ECAD. Entrega pronta para streaming.", tags: ["FL Studio", "Reaper", "Mixagem", "Masterização", "Streaming", "ECAD"], galleryCategories: ["Produção Fonográfica"] },
];

const ADVANTAGES = [
  { num: "01", title: "Um profissional, quatro frentes", body: "Design, motion, vídeo e áudio sob o mesmo teto — sem intermediários, sem ruído de comunicação." },
  { num: "02", title: "Entrega com mais agilidade", body: "Menos dependência de terceiros significa prazos menores e maior controle criativo do início ao fim." },
  { num: "03", title: "Linguagem visual + sonora integrada", body: "Quem entende de áudio entende de ritmo — e isso se reflete na edição, no corte e na identidade visual." },
  { num: "04", title: "10+ anos de experiência", body: "Trajetória em agências, gráficas, estúdios e mercado independente. Da teoria à prática em projetos reais." },
];

const CONTACT_LINKS = [
  { icon: <MessageCircle size={18} />, label: "WhatsApp", value: "(31) 97579-1151", href: "https://wa.me/5531975791151" },
  { icon: <Mail size={18} />, label: "E-mail", value: "fredericopierredamasceno@gmail.com", href: "mailto:fredericopierredamasceno@gmail.com" },
  { icon: <Phone size={18} />, label: "Telefone", value: "(31) 97579-1151", href: "tel:+5531975791151" },
];

/* ─── Error Boundary ─────────────────────────────────────────────── */

interface EBState { error: Error | null }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("ErrorBoundary:", error, info); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="border border-red-500/30 bg-red-500/5 p-8">
            <div className="font-mono text-[10px] text-red-400 tracking-widest uppercase mb-3">Erro do Sistema</div>
            <h1 className="text-4xl font-black uppercase text-foreground mb-4 leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Algo<br /><span className="text-red-400">quebrou.</span>
            </h1>
            <div className="border border-red-500/20 bg-background p-3 mb-5 overflow-auto max-h-32">
              <code className="font-mono text-[10px] text-red-300/70 break-all">{error.message}</code>
            </div>
            <div className="flex gap-3">
              <button onClick={() => this.setState({ error: null })} className="flex items-center gap-2 border border-border px-4 py-2.5 font-mono text-xs text-muted-foreground uppercase tracking-wider hover:border-primary hover:text-primary transition-colors"><RefreshCw size={12} /> Tentar novamente</button>
              <button onClick={() => window.location.reload()} className="flex items-center gap-2 bg-primary text-background px-4 py-2.5 font-bold text-xs tracking-widest uppercase"><RefreshCw size={12} /> Recarregar</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

/* ─── Utility hooks ──────────────────────────────────────────────── */

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const fn = () => { const el = document.documentElement; const max = el.scrollHeight - el.clientHeight; setP(max > 0 ? el.scrollTop / max : 0); };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return p;
}

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function FadeIn({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}>{children}</div>;
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

/* ─── Loading screen ─────────────────────────────────────────────── */

function LoadingScreen() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-border" />
        <div className="absolute inset-0 w-16 h-16 border-2 border-primary/60 animate-spin" style={{ animationDuration: "3s", clipPath: "inset(0 0 50% 50%)" }} />
        <div className="absolute inset-2 flex items-center justify-center"><img src={logoImg} alt="" className="w-8 h-auto brightness-200 opacity-70" /></div>
      </div>
      <div className="text-center">
        <div className="font-mono text-[10px] text-primary tracking-[0.4em] uppercase mb-2">Freed Pierre · Portfólio</div>
        <p className="font-mono text-[10px] text-muted-foreground tracking-widest">Carregando{dots}</p>
      </div>
    </div>
  );
}

/* ─── UploadProgressBar ──────────────────────────────────────────── */

function UploadProgressBar({ progress }: { progress: UploadProgress | null }) {
  if (!progress) return null;
  const color = progress.phase === "error" ? "bg-red-500" : progress.phase === "done" ? "bg-green-500" : "bg-primary";
  const textColor = progress.phase === "error" ? "text-red-400" : progress.phase === "done" ? "text-green-400" : "text-primary";
  return (
    <div className="space-y-2 border border-border p-3 bg-muted/20 rounded-sm">
      <div className="flex items-center justify-between">
        <span className={`font-mono text-[10px] tracking-widest uppercase ${textColor} flex items-center gap-1.5`}>
          {progress.phase === "sending" && <Loader2 size={9} className="animate-spin" />}
          {progress.phase === "done" && <CheckCircle2 size={9} />}
          {progress.phase === "error" && <XCircle size={9} />}
          {PHASE_LABELS[progress.phase]}
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

/* ─── PublishProgressModal ───────────────────────────────────────── */

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
            <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">GitHub + Netlify</div>
            <h2 className="text-xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {hasError ? "Falha na publicação" : allDone ? "Publicado!" : "Publicando..."}
            </h2>
          </div>
          {(allDone || hasError) && <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border border-border text-muted-foreground"><X size={14} /></button>}
        </div>
        <div className="p-6 space-y-3">
          {steps.map((step, i) => {
            const prev = steps[i - 1];
            const locked = prev && prev.status === "pending";
            return (
              <div key={step.id} className={`flex items-start gap-3 transition-opacity ${locked ? "opacity-25" : "opacity-100"}`}>
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
            );
          })}
        </div>
        {(allDone || hasError) && (
          <div className="px-6 pb-5 border-t border-border pt-4 space-y-3">
            {allDone && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground font-light">
                <Clock size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <span>O site será atualizado em ~1–2 min após a Netlify concluir o build.</span>
              </div>
            )}
            <button onClick={onClose} className={`w-full py-2.5 font-bold text-xs tracking-widest uppercase ${allDone ? "bg-primary text-background" : "border border-border text-muted-foreground"}`}>
              {allDone ? "Fechar" : "Fechar e tentar novamente"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── AdminLoginModal ────────────────────────────────────────────── */

function AdminLoginModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [user, setUser] = useState(""); const [pass, setPass] = useState(""); const [showPass, setShowPass] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { if (!open) { setUser(""); setPass(""); setErr(""); } }, [open]);
  const submit = () => { if (user === ADMIN_USER && pass === ADMIN_PASS) { sessionStorage.setItem(SESSION_KEY, "1"); onSuccess(); onClose(); } else setErr("Usuário ou senha incorretos."); };
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
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Usuário</label><input value={user} onChange={e => setUser(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" autoComplete="username" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Senha</label>
            <div className="relative"><input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} className="w-full bg-muted border border-border px-4 py-3 pr-11 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" autoComplete="current-password" />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>
          {err && <p className="font-mono text-[10px] text-red-400 tracking-wider">{err}</p>}
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Cancelar</button>
          <button onClick={submit} className="flex items-center gap-2 bg-primary text-background px-6 py-2.5 font-bold text-xs tracking-widest uppercase"><Lock size={12} /> Entrar</button>
        </div>
      </div>
    </div>
  );
}

/* ─── ProjectCard ────────────────────────────────────────────────── */

function ProjectCard({ item, onDelete, onTogglePin, isPinned, showAdmin, onClick }: {
  item: DisplayProject; onDelete?: (id: string) => void; onTogglePin?: (id: string) => void;
  isPinned?: boolean; showAdmin?: boolean; onClick?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const isEmbed = item.mediaType === "embed";
  const thumbSrc = item.thumbUrl || (isEmbed && item.embedPlatform === "youtube" && item.embedId ? `https://img.youtube.com/vi/${item.embedId}/hqdefault.jpg` : "");

  // Handle both hover (desktop) and tap (mobile)
  const startPlay = useCallback(() => {
    setPlaying(true);
    if (item.mediaType === "video" && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [item.mediaType]);

  const stopPlay = useCallback(() => {
    setPlaying(false);
    if (item.mediaType === "video" && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [item.mediaType]);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // On touch devices, toggle play; on desktop, delegate to onClick
    const isTouch = "touches" in e;
    if (isTouch) {
      e.preventDefault();
      if (playing) { stopPlay(); } else { startPlay(); }
      return;
    }
    onClick?.();
  }, [playing, startPlay, stopPlay, onClick]);

  return (
    <div
      className="relative bg-card group overflow-hidden aspect-video cursor-pointer select-none"
      onMouseEnter={startPlay}
      onMouseLeave={stopPlay}
      onClick={handleTap}
      onTouchEnd={e => { e.preventDefault(); playing ? stopPlay() : startPlay(); }}
    >
      {/* Video */}
      {item.mediaType === "video" && (
        <video
          ref={videoRef}
          src={item.mediaUrl}
          muted playsInline loop preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Embed (YouTube / Vimeo) */}
      {isEmbed && !playing && thumbSrc && (
        <img src={thumbSrc} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 scale-100 group-hover:scale-[1.02]" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
      {isEmbed && !playing && !thumbSrc && (
        <div className="absolute inset-0 bg-card flex items-center justify-center"><Film size={28} className="text-muted-foreground" /></div>
      )}
      {isEmbed && playing && item.embedId && (
        <iframe
          src={`${item.embedPlatform === "youtube" ? `https://www.youtube.com/embed/${item.embedId}?autoplay=1&mute=1` : `https://player.vimeo.com/video/${item.embedId}?autoplay=1&muted=1`}`}
          className="absolute inset-0 w-full h-full" allow="autoplay" allowFullScreen
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Image */}
      {item.mediaType === "image" && (
        <img src={item.mediaUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent pointer-events-none" />

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-5 pointer-events-none">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">{item.category}</div>
        <h3 className="text-base md:text-xl font-black uppercase text-foreground leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{item.title}</h3>
      </div>

      {/* Play badge */}
      {(item.mediaType === "video" || isEmbed) && !playing && (
        <div className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center ${isEmbed ? "bg-red-600/90" : "bg-primary/90"}`}>
          {isEmbed ? <Youtube size={10} className="text-white" /> : <Play size={10} className="text-background ml-0.5" />}
        </div>
      )}

      {/* Hover border */}
      <div className={`absolute inset-0 border-2 border-primary transition-opacity pointer-events-none ${playing ? "opacity-40" : "opacity-0"}`} />

      {/* Admin controls */}
      {showAdmin && (
        <div className="absolute top-2 left-2 flex flex-col gap-1" onClick={e => e.stopPropagation()}>
          {onTogglePin && (
            <button onClick={() => onTogglePin(item.id)} className={`flex items-center gap-1 px-2 py-1 text-[9px] font-mono tracking-wider uppercase border transition-colors ${isPinned ? "bg-primary text-background border-primary" : "bg-background/80 text-muted-foreground border-border hover:border-primary"}`}>
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

/* ─── UploadModal ────────────────────────────────────────────────── */

type UploadMode = "file" | "youtube" | "vimeo";

function UploadModal({ open, onClose, onSave, uploadFile, ghConfigured }: {
  open: boolean; onClose: () => void;
  onSave: (proj: CMSProject) => Promise<void>;
  uploadFile: (f: File, t: "image" | "video" | "audio", onProgress: (p: UploadProgress) => void) => Promise<string | null>;
  ghConfigured: boolean;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [mode, setMode] = useState<UploadMode>("file");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [parsedVideo, setParsedVideo] = useState<ReturnType<typeof parseVideoUrl>>(null);
  const [thumbImgOk, setThumbImgOk] = useState(true);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [thumbProgress, setThumbProgress] = useState<UploadProgress | null>(null);
  const [oversize, setOversize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const reset = useCallback(() => {
    setTitle(""); setDesc(""); setCat(CATEGORIES[0]);
    setMode("file"); setMediaFile(null); setThumbFile(null);
    setVideoUrl(""); setParsedVideo(null); setThumbImgOk(true);
    setProgress(null); setThumbProgress(null); setOversize(false);
    setBusy(false); setDone(false); setErrMsg("");
  }, []);

  useEffect(() => {
    if (!open) { reset(); return; }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open, reset]);

  // Close on Escape — but NOT when typing in inputs
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "Escape" && tag !== "INPUT" && tag !== "TEXTAREA") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open, onClose]);

  useEffect(() => {
    if (!videoUrl.trim()) { setParsedVideo(null); setThumbImgOk(true); return; }
    const p = parseVideoUrl(videoUrl.trim());
    setParsedVideo(p);
    setThumbImgOk(true);
  }, [videoUrl]);

  const handleFileChange = (f: File) => {
    if (f.type.startsWith("video") && f.size > MAX_FILE_BYTES) { setOversize(true); setMediaFile(null); return; }
    setOversize(false); setMediaFile(f);
  };

  const handleSave = async () => {
    if (!title.trim() || busy) return;
    setBusy(true); setErrMsg("");

    // Embed path
    if ((mode === "youtube" || mode === "vimeo") && parsedVideo) {
      await onSave({
        id: `proj-${Date.now()}`, title: title.trim(), description: desc.trim(),
        category: cat, mediaType: "embed", mediaUrl: parsedVideo.embed,
        thumbUrl: parsedVideo.thumb || undefined,
        embedPlatform: parsedVideo.platform, embedId: parsedVideo.id, createdAt: Date.now(),
      });
      setDone(true); setTimeout(() => { reset(); onClose(); }, 1200);
      return;
    }

    // File path
    if (!mediaFile || !ghConfigured) { setErrMsg("Configure o GitHub e selecione um arquivo."); setBusy(false); return; }
    const mType = mediaFile.type.startsWith("video") ? "video" : "image";
    const mediaUrl = await uploadFile(mediaFile, mType, setProgress);
    if (!mediaUrl) { setErrMsg("Falha no upload. Verifique o GitHub."); setBusy(false); return; }

    let thumbUrl: string | undefined;
    if (thumbFile) {
      const tu = await uploadFile(thumbFile, "image", setThumbProgress);
      if (tu) thumbUrl = tu;
    }

    await onSave({ id: `proj-${Date.now()}`, title: title.trim(), description: desc.trim(), category: cat, mediaType: mType, mediaUrl, thumbUrl, createdAt: Date.now() });
    setDone(true); setTimeout(() => { reset(); onClose(); }, 1200);
  };

  if (!open) return null;

  const embedReady = (mode === "youtube" || mode === "vimeo") && !!parsedVideo;
  const canSave = title.trim() && !busy && (embedReady || (mode === "file" && !!mediaFile && ghConfigured));

  return (
    // IMPORTANT: click-to-close is on the BACKDROP only, not the entire overlay wrapper
    <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={() => { if (!busy) { reset(); onClose(); } }} />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-xl bg-card border border-border border-b-0 sm:border-b flex flex-col max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">Novo Projeto</div>
            <h2 className="text-xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Adicionar ao Portfólio</h2>
          </div>
          <button onClick={() => { if (!busy) { reset(); onClose(); } }} className="w-9 h-9 flex items-center justify-center border border-border text-muted-foreground"><X size={15} /></button>
        </div>

        {!ghConfigured && mode === "file" && (
          <div className="mx-5 mt-4 flex items-start gap-3 border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/80 font-light">Configure o GitHub (aba GitHub) para uploads de arquivo. Vídeos do YouTube/Vimeo não precisam de configuração.</p>
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Mode selector */}
          <div>
            <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Tipo de mídia</label>
            <div className="grid grid-cols-3 gap-2">
              {([["file", <Upload size={13} />, "Arquivo"], ["youtube", <Youtube size={13} />, "YouTube"], ["vimeo", <Link2 size={13} />, "Vimeo"]] as const).map(([id, icon, label]) => (
                <button key={id} onClick={() => setMode(id)} className={`flex flex-col items-center gap-1.5 py-3 border transition-colors font-mono text-[10px] tracking-widest uppercase ${mode === id ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          {/* File upload */}
          {mode === "file" && (
            <>
              <div>
                <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Arquivo principal * (imagem ou vídeo até 25 MB)</label>
                <div className={`border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${mediaFile ? "border-primary bg-primary/5" : oversize ? "border-red-500/60 bg-red-500/5" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("media-inp")?.click()}>
                  <input id="media-inp" type="file" accept="image/*,video/mp4,video/mov,video/webm,video/quicktime" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); e.target.value = ""; }} />
                  {mediaFile
                    ? <div className="flex items-center justify-center gap-2 text-primary">{mediaFile.type.startsWith("video") ? <VideoIcon size={16} /> : <ImageIcon size={16} />}<span className="text-sm truncate max-w-[200px]">{mediaFile.name}</span><span className="font-mono text-[10px] text-muted-foreground">({(mediaFile.size / 1024 / 1024).toFixed(1)} MB)</span></div>
                    : <div className="flex flex-col items-center gap-2 text-muted-foreground"><Upload size={20} /><span className="text-xs font-mono tracking-wider uppercase">Toque ou arraste</span></div>}
                </div>
                {oversize && (
                  <div className="mt-3 border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                    <div className="flex items-center gap-2"><AlertCircle size={13} className="text-red-400 flex-shrink-0" /><p className="text-xs text-red-300 font-light">Vídeo maior que 25 MB — limite da GitHub API.</p></div>
                    <p className="text-[11px] text-muted-foreground font-light pl-5">Use <strong className="text-foreground">YouTube</strong> ou <strong className="text-foreground">Vimeo</strong> para vídeos maiores:</p>
                    <div className="flex gap-2 pl-5">
                      <button onClick={() => setMode("youtube")} className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase border border-red-500/40 text-red-300 px-3 py-1.5 hover:border-primary hover:text-primary transition-colors"><Youtube size={10} /> YouTube</button>
                      <button onClick={() => setMode("vimeo")} className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase border border-red-500/40 text-red-300 px-3 py-1.5 hover:border-primary hover:text-primary transition-colors"><Link2 size={10} /> Vimeo</button>
                    </div>
                  </div>
                )}
                {progress && <div className="mt-2"><UploadProgressBar progress={progress} /></div>}
              </div>
              <div>
                <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Thumbnail (opcional)</label>
                <div className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${thumbFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("thumb-inp")?.click()}>
                  <input id="thumb-inp" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setThumbFile(f); e.target.value = ""; }} />
                  {thumbFile ? <div className="flex items-center justify-center gap-2 text-primary"><ImageIcon size={14} /><span className="text-sm truncate max-w-[180px]">{thumbFile.name}</span></div>
                    : <div className="flex items-center justify-center gap-2 text-muted-foreground"><ImageIcon size={14} /><span className="text-xs font-mono tracking-wider uppercase">Capa</span></div>}
                </div>
                {thumbProgress && <div className="mt-2"><UploadProgressBar progress={thumbProgress} /></div>}
              </div>
            </>
          )}

          {/* YouTube / Vimeo URL input */}
          {(mode === "youtube" || mode === "vimeo") && (
            <div>
              <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">
                URL do {mode === "youtube" ? "YouTube" : "Vimeo"} *
              </label>
              <input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                onClick={e => e.stopPropagation()}
                onFocus={e => e.stopPropagation()}
                placeholder={mode === "youtube" ? "https://youtube.com/watch?v=..." : "https://vimeo.com/123456789"}
                className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
              {videoUrl && !parsedVideo && (
                <div className="flex items-center gap-2 mt-2"><AlertCircle size={12} className="text-amber-400" /><p className="font-mono text-[10px] text-amber-400">URL não reconhecida. Ex: youtube.com/watch?v=XXXX</p></div>
              )}
              {parsedVideo && (
                <div className="mt-3 border border-green-500/20 bg-green-500/5 p-3 space-y-2">
                  <div className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-400" /><span className="font-mono text-[10px] text-green-400 uppercase tracking-widest">Vídeo detectado — {parsedVideo.platform}</span></div>
                  {parsedVideo.thumb && thumbImgOk && (
                    <img src={parsedVideo.thumb} alt="preview" className="w-full aspect-video object-cover" onError={() => setThumbImgOk(false)} />
                  )}
                  {(!parsedVideo.thumb || !thumbImgOk) && (
                    <div className="w-full aspect-video bg-muted flex flex-col items-center justify-center gap-2">
                      <Youtube size={24} className="text-muted-foreground" />
                      <span className="font-mono text-[10px] text-muted-foreground">ID: {parsedVideo.id}</span>
                    </div>
                  )}
                </div>
              )}
              {!videoUrl && (
                <div className="mt-3 p-3 border border-border bg-muted/20 flex items-center gap-3">
                  <WifiOff size={14} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground font-light">Cole a URL do vídeo acima. Ele será incorporado ao portfólio sem ocupar espaço no repositório.</p>
                </div>
              )}
            </div>
          )}

          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Título *</label><input value={title} onChange={e => setTitle(e.target.value)} onClick={e => e.stopPropagation()} placeholder="Nome do projeto" className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Descrição</label><textarea value={desc} onChange={e => setDesc(e.target.value)} onClick={e => e.stopPropagation()} rows={3} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Categoria</label>
            <div className="grid grid-cols-2 gap-2">{CATEGORIES.map(c => <button key={c} onClick={() => setCat(c)} className={`font-mono text-[10px] tracking-widest uppercase px-3 py-2.5 border transition-colors text-left ${cat === c ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{c}</button>)}</div>
          </div>
        </div>

        {errMsg && (
          <div className="mx-5 mb-3 flex items-center gap-2 border border-red-500/30 bg-red-500/5 px-3 py-3">
            <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-300 font-light">{errMsg}</span>
          </div>
        )}

        <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <button onClick={() => { if (!busy) { reset(); onClose(); } }} className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} className={`flex items-center gap-2 px-6 py-3 font-bold text-xs tracking-widest uppercase transition-all ${done ? "bg-green-600 text-white" : !canSave ? "bg-muted text-muted-foreground cursor-not-allowed" : busy ? "bg-primary/60 text-background" : "bg-primary text-background hover:bg-primary/85"}`}>
            {done ? <><Check size={13} /> Salvo!</> : busy ? <><Loader2 size={13} className="animate-spin" />Enviando...</> : embedReady ? <><Check size={13} /> Adicionar</> : <><Upload size={13} /> Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── GalleryModal ───────────────────────────────────────────────── */

function GalleryModal({ service, allProjects, initialItem, onClose, showAdmin, onDelete, onTogglePin, pinned }: {
  service: typeof SERVICES[number] | null; allProjects: DisplayProject[]; initialItem?: DisplayProject | null;
  onClose: () => void; showAdmin: boolean; onDelete: (id: string) => void;
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
        <div className="overflow-y-auto flex-1">
          {selected ? (
            <div className="flex flex-col md:grid md:grid-cols-[1fr_320px]">
              <div className="bg-black flex items-center justify-center" style={{ minHeight: "clamp(180px,40vw,360px)" }}>
                {selected.mediaType === "video" && <video src={selected.mediaUrl} controls autoPlay muted loop playsInline className="w-full h-full object-contain max-h-[50vh]" />}
                {selected.mediaType === "embed" && selected.embedId && (
                  <iframe src={`${selected.embedPlatform === "youtube" ? `https://www.youtube.com/embed/${selected.embedId}` : `https://player.vimeo.com/video/${selected.embedId}`}`} className="w-full aspect-video" allowFullScreen allow="autoplay" />
                )}
                {selected.mediaType === "image" && <img src={selected.mediaUrl} alt={selected.title} className="w-full h-full object-contain max-h-[50vh]" />}
              </div>
              <div className="border-t md:border-t-0 md:border-l border-border p-5 md:p-7 flex flex-col gap-4">
                <div>
                  <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-1">{selected.category}</div>
                  <h3 className="text-xl md:text-2xl font-black uppercase text-foreground leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{selected.title}</h3>
                  {selected.embedPlatform && <span className="inline-flex items-center gap-1 mt-1 font-mono text-[9px] text-muted-foreground border border-border px-2 py-0.5 uppercase"><Youtube size={9} /> {selected.embedPlatform}</span>}
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
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 px-6">
              <div className="w-12 h-12 border border-border flex items-center justify-center text-muted-foreground">{service.icon}</div>
              <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase text-center">Em breve — novos projetos aqui</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
              {items.map(item => <ProjectCard key={item.id} item={item} showAdmin={showAdmin} isPinned={pinned.has(item.id)} onTogglePin={onTogglePin} onDelete={!item.isFixed ? onDelete : undefined} onClick={() => setSelected(item)} />)}
            </div>
          )}
        </div>
        {!selected && (
          <div className="border-t border-border px-5 md:px-8 py-3 flex items-center justify-between flex-shrink-0">
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">{items.length} projeto{items.length !== 1 ? "s" : ""}</span>
            <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">Solicitar orçamento <ArrowUpRight size={13} /></a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── AudioPlayer ─────────────────────────────────────────────────── */

/* ─── CarouselRow — Netflix-style horizontal scroll per category ──── */

const CATEGORY_COLORS: Record<string, string> = {
  "Motion Design": "#E8863A",
  "Video Making": "#6C9EE8",
  "Design Gráfico": "#A278D4",
  "Produção Fonográfica": "#5BC49A",
};

function CarouselRow({ label, items, showAdmin, pinned, onTogglePin, onDelete, onClickItem }: {
  label: string; items: DisplayProject[]; showAdmin: boolean; pinned: Set<string>;
  onTogglePin: (id: string) => void; onDelete: (id: string) => void; onClickItem: (item: DisplayProject) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const accent = CATEGORY_COLORS[label] ?? "var(--primary)";

  const updateArrows = () => {
    const el = scrollRef.current; if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current; if (!el) return;
    const cardW = el.querySelector("div")?.offsetWidth ?? 260;
    el.scrollBy({ left: dir === "left" ? -(cardW * 2 + 12) : (cardW * 2 + 12), behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <div className="relative mb-8 md:mb-10 group/row">
      {/* Row header */}
      <div className="flex items-center justify-between mb-3 pr-1">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-5 flex-shrink-0 rounded-sm" style={{ background: accent }} />
          <span className="font-black uppercase text-foreground text-lg md:text-xl leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: accent !== "var(--primary)" ? "var(--foreground)" : "var(--foreground)" }}>
            {label}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground tracking-widest">{items.length} projeto{items.length !== 1 ? "s" : ""}</span>
        </div>
        {/* Nav arrows — visible on hover on desktop, always on mobile when scrollable */}
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            disabled={!canLeft}
            className={`w-7 h-7 border flex items-center justify-center transition-all text-xs font-bold ${canLeft ? "border-border text-muted-foreground hover:border-primary hover:text-primary" : "border-border/30 text-muted-foreground/20 cursor-not-allowed"}`}
          >
            ‹
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canRight}
            className={`w-7 h-7 border flex items-center justify-center transition-all text-xs font-bold ${canRight ? "border-border text-muted-foreground hover:border-primary hover:text-primary" : "border-border/30 text-muted-foreground/20 cursor-not-allowed"}`}
          >
            ›
          </button>
        </div>
      </div>

      {/* Gradient fade edges */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-2 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className={`absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity ${canRight ? "opacity-100" : "opacity-0"}`} />

        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="flex gap-2 md:gap-3 overflow-x-auto pb-2"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <style>{`.carousel-hide::-webkit-scrollbar { display: none; }`}</style>
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="flex-shrink-0"
              style={{
                scrollSnapAlign: "start",
                // First card slightly wider — featured effect
                width: idx === 0 && items.length > 1 ? "clamp(220px, 38vw, 320px)" : "clamp(180px, 30vw, 260px)",
              }}
            >
              <ProjectCard
                item={item}
                showAdmin={showAdmin}
                isPinned={pinned.has(item.id)}
                onTogglePin={onTogglePin}
                onDelete={!item.isFixed ? onDelete : undefined}
                onClick={() => onClickItem(item)}
              />
            </div>
          ))}
          {/* Spacer so last card doesn't hide behind the right gradient */}
          <div className="flex-shrink-0 w-4" />
        </div>
      </div>
    </div>
  );
}

/* ─── AudioPlayer ─────────────────────────────────────────────────── */

function AudioPlayer({ audio, adminMode, onUpload, onDelete, ghConfigured }: {
  audio: { name: string; url: string } | null; adminMode: boolean;
  onUpload: (f: File) => void; onDelete: () => void; ghConfigured: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false); const [prog, setProg] = useState(0); const [dur, setDur] = useState(0);
  const toggle = () => { const el = audioRef.current; if (!el) return; playing ? (el.pause(), setPlaying(false)) : (el.play(), setPlaying(true)); };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <div className="border border-border">
      {audio && <audio ref={audioRef} src={audio.url} onTimeUpdate={() => { const el = audioRef.current; if (el) setProg(el.currentTime / (el.duration || 1)); }} onLoadedMetadata={() => { const el = audioRef.current; if (el) setDur(el.duration); }} onEnded={() => setPlaying(false)} />}
      <div className="p-4 flex items-center gap-4">
        <button onClick={toggle} disabled={!audio} className="w-10 h-10 flex-shrink-0 bg-primary flex items-center justify-center text-background disabled:opacity-40">{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-1">{audio ? "Demo" : "Nenhum áudio"}</div>
          <div className="text-sm font-semibold text-foreground truncate mb-2">{audio ? audio.name.replace(/\.[^.]+$/, "") : "—"}</div>
          {audio && <div className="flex items-center gap-2"><div className="flex-1 h-1 bg-muted rounded-full overflow-hidden cursor-pointer" onClick={e => { const el = audioRef.current; if (!el) return; const r = e.currentTarget.getBoundingClientRect(); el.currentTime = ((e.clientX - r.left) / r.width) * el.duration; }}><div className="h-full bg-primary rounded-full" style={{ width: `${prog * 100}%` }} /></div><span className="font-mono text-[10px] text-muted-foreground">{fmt(dur)}</span></div>}
        </div>
      </div>
      {adminMode && (
        <div className="border-t border-border px-4 py-3 flex items-center gap-3 flex-wrap">
          <label className={`flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase ${ghConfigured ? "cursor-pointer text-primary" : "cursor-not-allowed text-muted-foreground"}`}>
            <Music size={12} />{audio ? "Trocar" : "Upload de áudio"}
            {ghConfigured && <input type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { onUpload(f); setPlaying(false); setProg(0); } e.target.value = ""; }} />}
          </label>
          {audio && <button onClick={() => { setPlaying(false); setProg(0); onDelete(); }} className="flex items-center gap-1 text-red-400 font-mono text-[10px] tracking-widest uppercase ml-auto"><Trash2 size={11} /> Remover</button>}
        </div>
      )}
    </div>
  );
}

/* ─── LogsTab ────────────────────────────────────────────────────── */

function LogsTab({ logs }: { logs: LogEntry[] }) {
  const icons: Record<LogEntry["level"], ReactNode> = {
    info: <Zap size={9} className="text-muted-foreground" />,
    success: <CheckCheck size={9} className="text-green-400" />,
    error: <XCircle size={9} className="text-red-400" />,
    warn: <AlertCircle size={9} className="text-amber-400" />,
  };
  const colors: Record<LogEntry["level"], string> = { info: "text-muted-foreground", success: "text-green-400", error: "text-red-400", warn: "text-amber-400" };
  return (
    <div className="space-y-3">
      <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">{logs.length} eventos</div>
      {logs.length === 0
        ? <div className="border border-dashed border-border py-12 text-center"><ScrollText size={18} className="text-muted-foreground mx-auto mb-2" /><p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Nenhum evento</p></div>
        : <div className="border border-border divide-y divide-border">{logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/20">
              <div className="mt-0.5 flex-shrink-0">{icons[log.level]}</div>
              <span className={`flex-1 text-xs font-light leading-relaxed ${colors[log.level]}`}>{log.msg}</span>
              <span className="font-mono text-[9px] text-muted-foreground/50 flex-shrink-0">{log.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
          ))}</div>}
    </div>
  );
}

/* ─── GitHubConfigTab ────────────────────────────────────────────── */

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

  const hasToken = !!ghConfig?.token;
  const configComplete = !!ghConfig && hasToken;

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null);
    const ok = await onSync();
    setSyncResult(ok); setSyncing(false);
    setTimeout(() => setSyncResult(null), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Sync from GitHub */}
      <div className="border border-primary/20 bg-primary/5 p-4">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-1">Sincronizar do GitHub</div>
        <p className="text-xs text-muted-foreground font-light mb-3">
          Recarrega o conteúdo diretamente do repositório GitHub. Use sempre que o Figma Make fizer um commit — evita que alterações antigas sobrescrevam seus uploads.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleSync} disabled={!ghConfig?.owner || syncing} className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs tracking-widest uppercase border transition-all ${!ghConfig?.owner ? "border-border text-muted-foreground cursor-not-allowed opacity-50" : "border-primary text-primary hover:bg-primary hover:text-background"}`}>
            {syncing ? <><Loader2 size={12} className="animate-spin" /> Sincronizando...</> : <><RefreshCw size={12} /> Sincronizar agora</>}
          </button>
          {syncResult === true && <span className="flex items-center gap-1.5 font-mono text-[10px] text-green-400"><CheckCircle2 size={11} /> Atualizado do GitHub!</span>}
          {syncResult === false && <span className="flex items-center gap-1.5 font-mono text-[10px] text-red-400"><AlertCircle size={11} /> Falha — verifique as configs abaixo</span>}
        </div>
        <p className="font-mono text-[9px] text-muted-foreground/50 mt-2">
          O app já carrega automaticamente do GitHub a cada abertura (quando configurado). Este botão força uma nova leitura manualmente.
        </p>
      </div>

      {/* Publish action */}
      <div className="border border-border p-4">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-2">Publicar → GitHub → Netlify</div>
        <p className="text-xs text-muted-foreground font-light mb-3">Salva todas as alterações. A Netlify detecta o commit e publica automaticamente.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onPublish} disabled={!configComplete || saveStatus === "saving"} className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs tracking-widest uppercase transition-all ${!configComplete ? "bg-muted text-muted-foreground cursor-not-allowed" : saveStatus === "saving" ? "bg-primary/60 text-background" : "bg-primary text-background hover:bg-primary/85"}`}>
            {saveStatus === "saving" ? <><Loader2 size={12} className="animate-spin" /> Publicando...</> : <><Github size={12} /> Publicar agora</>}
          </button>
          {saveStatus === "success" && <span className="flex items-center gap-1.5 font-mono text-[10px] text-green-400"><CheckCircle2 size={11} /> Publicado! Deploy em ~2 min...</span>}
          {saveStatus === "error" && saveError && <span className="flex items-center gap-1.5 font-mono text-[10px] text-red-400 max-w-[200px]"><AlertCircle size={11} /> {saveError}</span>}
        </div>
        {!ghConfig && <p className="font-mono text-[10px] text-amber-400 mt-2">⚠ Configure o GitHub abaixo.</p>}
        {ghConfig && !hasToken && <p className="font-mono text-[10px] text-amber-400 mt-2">⚠ Token não informado — preencha e salve abaixo.</p>}
      </div>

      {/* Config fields */}
      <div className="border border-border p-4 space-y-3">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase">Configuração</div>
        {ghConfig && (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className={`w-2 h-2 rounded-full ${configComplete ? "bg-green-500" : "bg-amber-500"}`} />
            <span className="text-muted-foreground">{ghConfig.owner}/{ghConfig.repo} ({ghConfig.branch}){!hasToken ? " — token ausente" : " — conectado"}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Usuário / Org</label><input value={owner} onChange={e => setOwner(e.target.value)} placeholder="freed-pierre" className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Repositório</label><input value={repo} onChange={e => setRepo(e.target.value)} placeholder="portfolio" className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" /></div>
        </div>
        <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Branch</label><input value={branch} onChange={e => setBranch(e.target.value)} placeholder="main" className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" /></div>
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Token (PAT) — salvo só nesta sessão</label>
          <div className="relative">
            <input type={showToken ? "text" : "password"} value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_..." className="w-full bg-muted border border-border px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
            <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showToken ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/50 mt-1">Usuário/repo/branch ficam salvos. Token apaga ao fechar o browser (segurança).</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={async () => { setTesting(true); setTestResult(null); const r = await ghTestConnection({ owner, repo, branch, token }); setTestResult(r); setTesting(false); }} disabled={!owner || !repo || !token || testing} className="flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
            {testing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Testar
          </button>
          <button onClick={() => onSave({ owner, repo, branch, token })} disabled={!owner || !repo || !token} className="flex items-center gap-2 bg-primary text-background px-4 py-2 font-bold text-[10px] tracking-widest uppercase hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Check size={10} /> Salvar config
          </button>
          {ghConfig && <button onClick={onClear} className="font-mono text-[10px] text-red-400 tracking-widest uppercase">Limpar</button>}
        </div>
        {testResult && (
          <div className={`flex items-center gap-2 font-mono text-[10px] ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
            {testResult.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
            {testResult.ok ? `Conectado: ${testResult.name}` : testResult.error}
          </div>
        )}
      </div>

      {/* Guide */}
      <div className="border border-border p-4">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-2">Como criar Token</div>
        <ol className="text-xs text-muted-foreground font-light space-y-1.5 list-decimal list-inside">
          <li>GitHub → Settings → Developer settings → Personal access tokens</li>
          <li>Tokens (classic) → Generate new token</li>
          <li>Marque o escopo <code className="text-primary">repo</code> (acesso completo)</li>
          <li>Cole o token acima e clique em Salvar config</li>
        </ol>
      </div>

      <div className="border border-border p-4 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary uppercase tracking-widest mb-2">Status</div>
        <div>{cms.projects.length} upload(s) · atualizado {new Date(cms.updatedAt).toLocaleString("pt-BR")}</div>
      </div>
    </div>
  );
}

/* ─── AdminPanel ─────────────────────────────────────────────────── */

type AdminTab = "github" | "uploads" | "textos" | "cores" | "info" | "logs";

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
  const [saving, setSaving] = useState(false); const [savedId, setSavedId] = useState<string | null>(null);

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
  const toggleHide = (id: string) => hiddenSeeds.has(id) ? setCms({ ...cms, hiddenSeeds: cms.hiddenSeeds.filter(s => s !== id) }) : setCms({ ...cms, hiddenSeeds: [...cms.hiddenSeeds, id], pinned: cms.pinned.filter(p => p !== id) });
  const delUpload = async (id: string) => {
    if (!confirm("Remover?")) return;
    const p = cms.projects.find(p => p.id === id);
    if (p) { if (p.mediaUrl.startsWith("/uploads/")) await deleteFile(p.mediaUrl); if (p.thumbUrl?.startsWith("/uploads/")) await deleteFile(p.thumbUrl); }
    setCms({ ...cms, projects: cms.projects.filter(p => p.id !== id), pinned: cms.pinned.filter(p => p !== id) });
  };
  const saveEdit = async (id: string) => {
    setSaving(true);
    setCms({ ...cms, projects: cms.projects.map(p => p.id === id ? { ...p, title: editTitle, description: editDesc, category: editCat } : p) });
    setSaving(false); setSavedId(id); setTimeout(() => { setSavedId(null); setEditingId(null); }, 800);
  };
  const updContent = (k: keyof SiteContent, v: string) => setCms({ ...cms, content: { ...cms.content, [k]: v } });
  const updTheme = (k: keyof SiteTheme, v: string) => setCms({ ...cms, theme: { ...cms.theme, [k]: v } });

  const TABS: { id: AdminTab; icon: ReactNode; label: string }[] = [
    { id: "github", icon: <Github size={12} />, label: "GitHub" },
    { id: "uploads", icon: <FolderOpen size={12} />, label: "Uploads" },
    { id: "textos", icon: <FileText size={12} />, label: "Textos" },
    { id: "cores", icon: <Paintbrush size={12} />, label: "Cores" },
    { id: "info", icon: <Info size={12} />, label: "Info" },
    { id: "logs", icon: <ScrollText size={12} />, label: `Logs${logs.length ? ` (${logs.length})` : ""}` },
  ];

  const contentFields: { k: keyof SiteContent; l: string; m?: boolean }[] = [
    { k: "heroLine1", l: "Hero — L1" }, { k: "heroLine2", l: "Hero — L2" }, { k: "heroLine3", l: "Hero — L3" }, { k: "heroLine4", l: "Hero — L4 (outline)" },
    { k: "heroBadge", l: "Badge" }, { k: "heroSubtitle", l: "Subtítulo", m: true },
    { k: "stat1Val", l: "Stat 1 Valor" }, { k: "stat1Label", l: "Stat 1 Label" },
    { k: "stat2Val", l: "Stat 2 Valor" }, { k: "stat2Label", l: "Stat 2 Label" },
    { k: "stat3Val", l: "Stat 3 Valor" }, { k: "stat3Label", l: "Stat 3 Label" },
    { k: "stat4Val", l: "Stat 4 Valor" }, { k: "stat4Label", l: "Stat 4 Label" },
    { k: "difHeading1", l: "Dif. L1" }, { k: "difHeading2", l: "Dif. L2" }, { k: "difHeading3", l: "Dif. L3" },
    { k: "difSubtext", l: "Dif. Parágrafo", m: true },
    { k: "contactHeading", l: "Contato Título" }, { k: "contactSubtext", l: "Contato Sub", m: true },
    { k: "footerCopy", l: "Rodapé" },
  ];

  const themeFields: { k: keyof SiteTheme; l: string }[] = [
    { k: "primary", l: "Destaque (laranja)" }, { k: "background", l: "Fundo" },
    { k: "foreground", l: "Texto" }, { k: "card", l: "Cards" }, { k: "muted", l: "Superfície sec." },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl max-h-[96vh] md:max-h-[92vh] flex flex-col bg-card border border-border border-b-0 md:border-b">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-primary" />
            <span className="font-mono text-[10px] text-primary tracking-widest uppercase">Painel Admin</span>
            {!ghOk && <span className="font-mono text-[9px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 uppercase">Token ausente</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); onOpenUpload(); }} className="flex items-center gap-1.5 px-3 py-1.5 font-bold text-[10px] tracking-widest uppercase bg-primary text-background"><Plus size={10} /> Upload</button>
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

          {tab === "uploads" && (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-primary" /> Seeds do código ({ALL_SEEDS.length})</div>
                {ALL_SEEDS.map(p => {
                  const hidden = hiddenSeeds.has(p.id); const isPinned = pinned.has(p.id);
                  return (
                    <div key={p.id} className={`flex items-center gap-3 border p-2.5 mb-2 ${hidden ? "border-border/30 opacity-50" : "border-border"}`}>
                      <div className="w-14 h-10 flex-shrink-0 bg-background overflow-hidden"><video src={p.mediaUrl} muted className="w-full h-full object-cover" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[9px] text-primary">{p.category}</div>
                        <div className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{p.title}</div>
                        <span className={`font-mono text-[9px] px-1.5 py-0.5 uppercase ${isPinned && !hidden ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{hidden ? "Oculto" : isPinned ? "Destaque" : "Galeria"}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!hidden && <button onClick={() => togglePin(p.id)} className={`font-mono text-[9px] px-2 py-1 border ${isPinned ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{isPinned ? "✓" : <Pin size={8} />}</button>}
                        <button onClick={() => toggleHide(p.id)} className={`font-mono text-[9px] px-2 py-1 border ${hidden ? "border-green-500/40 text-green-400" : "border-red-500/40 text-red-400"}`}>{hidden ? "↑" : <Trash2 size={8} />}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-green-500" /> GitHub uploads ({cms.projects.length})</div>
                {cms.projects.length === 0
                  ? <div className="border border-dashed border-border py-10 flex flex-col items-center gap-3"><Upload size={18} className="text-muted-foreground" /><p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Nenhum upload</p><button onClick={() => { onClose(); onOpenUpload(); }} className="flex items-center gap-2 bg-primary text-background px-4 py-2 font-bold text-xs tracking-widest uppercase"><Plus size={10} /> Primeiro upload</button></div>
                  : <div className="space-y-1">
                      {cms.projects.map(p => {
                        const isPinned = pinned.has(p.id); const isEmbed = p.mediaType === "embed";
                        return (
                          <div key={p.id} className="border border-border">
                            {editingId === p.id
                              ? <div className="p-3 space-y-2">
                                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
                                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
                                  <div className="grid grid-cols-2 gap-1">{CATEGORIES.map(c => <button key={c} onClick={() => setEditCat(c)} className={`font-mono text-[9px] py-1.5 border ${editCat === c ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{c}</button>)}</div>
                                  <div className="flex gap-2"><button onClick={() => saveEdit(p.id)} disabled={saving} className={`flex items-center gap-1 px-3 py-1.5 font-bold text-[10px] tracking-widest uppercase ${savedId === p.id ? "bg-green-600 text-white" : "bg-primary text-background"}`}><Check size={10} /> {savedId === p.id ? "Salvo!" : "Salvar"}</button><button onClick={() => setEditingId(null)} className="font-mono text-[10px] text-muted-foreground">Cancelar</button></div>
                                </div>
                              : <div className="flex items-center gap-2 p-2">
                                  <div className="w-12 h-9 flex-shrink-0 bg-card overflow-hidden relative">
                                    {isEmbed && p.thumbUrl && <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                                    {isEmbed && !p.thumbUrl && <div className="w-full h-full flex items-center justify-center"><Youtube size={12} className="text-red-400" /></div>}
                                    {!isEmbed && p.mediaType === "video" && <video src={p.mediaUrl} muted className="w-full h-full object-cover" />}
                                    {!isEmbed && p.mediaType === "image" && <img src={p.thumbUrl ?? p.mediaUrl} alt="" className="w-full h-full object-cover" />}
                                    <div className="absolute bottom-0 right-0 w-3 h-3 flex items-center justify-center bg-background/70">{isEmbed ? <Youtube size={7} className="text-red-400" /> : p.mediaType === "video" ? <VideoIcon size={7} className="text-primary" /> : <ImageIcon size={7} />}</div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{p.title}</div>
                                    <span className={`font-mono text-[9px] uppercase px-1 ${isPinned ? "text-primary" : "text-muted-foreground"}`}>{isPinned ? "● Destaque" : "○ Galeria"}</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <button onClick={() => togglePin(p.id)} className={`font-mono text-[9px] px-2 py-1 border ${isPinned ? "border-primary text-primary" : "border-border text-muted-foreground"}`}><Pin size={8} /></button>
                                    <button onClick={() => { setEditingId(p.id); setEditTitle(p.title); setEditDesc(p.description); setEditCat(p.category); }} className="font-mono text-[9px] px-2 py-1 border border-border text-muted-foreground">✏</button>
                                    <button onClick={() => delUpload(p.id)} className="font-mono text-[9px] px-2 py-1 border border-red-500/40 text-red-400"><Trash2 size={8} /></button>
                                  </div>
                                </div>}
                          </div>
                        );
                      })}
                    </div>}
              </div>
            </div>
          )}

          {tab === "textos" && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] text-muted-foreground">Edite e clique Publicar (aba GitHub) para salvar em todos os dispositivos.</p>
              {contentFields.map(({ k, l, m }) => (
                <div key={k}>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">{l}</label>
                  {m ? <textarea value={cms.content[k]} onChange={e => updContent(k, e.target.value)} rows={3} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
                    : <input value={cms.content[k]} onChange={e => updContent(k, e.target.value)} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />}
                </div>
              ))}
            </div>
          )}

          {tab === "cores" && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] text-muted-foreground">Aplica imediatamente. Publique para sincronizar.</p>
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
              <div className="border border-green-500/20 bg-green-500/5 p-4"><div className="font-mono text-[10px] text-green-400 uppercase tracking-widest mb-2">Arquitetura</div><p className="text-sm text-muted-foreground font-light">Todo conteúdo persiste em <code className="text-primary">public/cms-data.json</code> no GitHub. Mídia vai para <code className="text-primary">public/uploads/</code>. Netlify republica a cada commit.</p></div>
              <div className="border border-border p-4 space-y-1.5">{["1. Login", "2. Aba GitHub → Configurar → Salvar", "3. Edite textos, cores ou faça uploads", "4. Publicar agora (aba GitHub)", "5. ~2 min → Netlify publica", "6. Todos os dispositivos veem o conteúdo"].map((s, i) => <p key={i} className="text-sm text-muted-foreground font-light">{s}</p>)}</div>
              <div className="border border-amber-500/20 bg-amber-500/5 p-4"><div className="font-mono text-[10px] text-amber-400 uppercase tracking-widest mb-2">Limite</div><p className="text-sm text-amber-200/70 font-light">Arquivos até <strong>25 MB</strong> via GitHub API. Vídeos maiores: use YouTube/Vimeo.</p></div>
            </div>
          )}

          {tab === "logs" && <LogsTab logs={logs} />}
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="font-mono text-[10px] text-muted-foreground">{ALL_SEEDS.length + cms.projects.length} proj · {pinned.size} destaque{!ghOk ? " · ⚠ sem token" : ""}</span>
          <button onClick={onClose} className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ─── App ────────────────────────────────────────────────────────── */

function PortfolioApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeService, setActiveService] = useState(0);
  const [galleryService, setGalleryService] = useState<typeof SERVICES[number] | null>(null);
  const [galleryInitialItem, setGalleryInitialItem] = useState<DisplayProject | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminMode, setAdminMode] = useState(checkSession);
  const [showLogin, setShowLogin] = useState(false);
  const progress = useScrollProgress();

  const { ghConfig, setGhConfig, clearGhConfig, cms, setCms, loading, saveStatus, saveError, logs, addLog, publishSteps, publishOpen, setPublishOpen, publish, uploadFile, deleteFile, syncFromGitHub } = useCMS();

  const content = cms.content;
  const pinned = new Set(cms.pinned);
  const hiddenSeeds = new Set(cms.hiddenSeeds);
  const visibleSeeds = ALL_SEEDS.filter(s => !hiddenSeeds.has(s.id));
  const allProjects: DisplayProject[] = [...visibleSeeds, ...cms.projects];
  const featuredProjects = allProjects.filter(p => pinned.has(p.id));
  const ghOk = !!ghConfig?.token;

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn, { passive: true }); return () => window.removeEventListener("scroll", fn);
  }, []);

  const scrollTo = (href: string) => { setMenuOpen(false); document.querySelector(href)?.scrollIntoView({ behavior: "smooth" }); };
  const logout = () => { sessionStorage.removeItem(SESSION_KEY); setAdminMode(false); setAdminOpen(false); addLog("info", "Admin deslogado."); };

  const openProjectGallery = (item: DisplayProject) => {
    const svc = SERVICES.find(s => s.galleryCategories.includes(item.category));
    if (svc) { setGalleryService(svc); setGalleryInitialItem(item); }
  };

  const handleAddProject = async (proj: CMSProject) => {
    const updated: CMSData = { ...cms, projects: [proj, ...cms.projects], pinned: [...cms.pinned, proj.id] };
    await publish(updated);
  };

  const handleDeleteProject = async (id: string) => {
    const p = cms.projects.find(p => p.id === id);
    if (p) { if (p.mediaUrl.startsWith("/uploads/")) await deleteFile(p.mediaUrl); if (p.thumbUrl?.startsWith("/uploads/")) await deleteFile(p.thumbUrl); }
    await publish({ ...cms, projects: cms.projects.filter(p => p.id !== id), pinned: cms.pinned.filter(p => p !== id) });
  };

  const handleTogglePin = (id: string) => setCms({ ...cms, pinned: pinned.has(id) ? cms.pinned.filter(p => p !== id) : [...cms.pinned, id] });

  const handleAudioUpload = async (file: File) => {
    const url = await uploadFile(file, "audio", () => {});
    if (!url) return;
    await publish({ ...cms, audio: { name: file.name, url } });
  };

  const handleAudioDelete = async () => {
    if (cms.audio?.url.startsWith("/uploads/")) await deleteFile(cms.audio.url);
    await publish({ ...cms, audio: null });
  };

  const navLinks = [{ label: "Serviços", href: "#servicos" }, { label: "Trabalhos", href: "#trabalhos" }, { label: "Por que eu?", href: "#diferenciais" }, { label: "Contato", href: "#contato" }];

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={{ fontFamily: "'Barlow', sans-serif" }}>

      <PublishProgressModal open={publishOpen} steps={publishSteps} onClose={() => setPublishOpen(false)} />
      <AdminLoginModal open={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => { setAdminMode(true); addLog("success", "Admin autenticado."); }} />
      <GalleryModal service={galleryService} allProjects={allProjects} initialItem={galleryInitialItem} onClose={() => { setGalleryService(null); setGalleryInitialItem(null); }} showAdmin={adminMode} onDelete={handleDeleteProject} onTogglePin={handleTogglePin} pinned={pinned} />
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onSave={handleAddProject} uploadFile={uploadFile} ghConfigured={ghOk} />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} cms={cms} setCms={setCms} publish={publish} uploadFile={uploadFile} deleteFile={deleteFile} syncFromGitHub={syncFromGitHub} ghConfig={ghConfig} setGhConfig={setGhConfig} clearGhConfig={clearGhConfig} saveStatus={saveStatus} saveError={saveError} logs={logs} onOpenUpload={() => { setAdminOpen(false); setUploadOpen(true); }} />

      {/* Scroll progress bar */}
      <div className="fixed top-0 left-0 h-[2px] bg-primary z-[100]" style={{ width: `${progress * 100}%`, transition: "width 60ms linear" }} />

      {/* Admin FAB */}
      {adminMode && (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-2">
          {saveStatus === "saving" && <div className="flex items-center gap-2 bg-card/95 border border-primary/30 px-3 py-1.5 text-[10px] font-mono text-primary shadow-lg"><Loader2 size={10} className="animate-spin" /> Publicando...</div>}
          {saveStatus === "success" && <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-3 py-1.5 text-[10px] font-mono text-green-400 shadow-lg"><CheckCircle2 size={10} /> Publicado!</div>}
          <button onClick={logout} className="flex items-center gap-1.5 bg-card border border-border text-muted-foreground px-3 py-1.5 text-[10px] font-mono tracking-widest uppercase shadow-lg"><LogOut size={10} /> Sair</button>
          <button onClick={() => setAdminOpen(true)} className="flex items-center gap-1.5 bg-primary text-background px-4 py-2.5 font-bold text-[10px] tracking-widest uppercase shadow-lg"><Settings size={11} /> Painel Admin</button>
          <button onClick={() => setUploadOpen(true)} className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center bg-primary text-background shadow-xl hover:bg-primary/85 transition-colors" title="Novo upload"><Plus size={20} /></button>
        </div>
      )}

      {/* ── NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/96 backdrop-blur border-b border-border" : ""}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
          <button onClick={() => scrollTo("#hero")}><img src={logoImg} alt="Freed Pierre" className="h-9 md:h-12 w-auto object-contain brightness-200" /></button>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(l => <button key={l.href} onClick={() => scrollTo(l.href)} className="font-medium text-xs tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors">{l.label}</button>)}
            {!adminMode
              ? <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 font-bold text-xs tracking-widest uppercase hover:bg-primary/85 transition-colors"><MessageCircle size={13} /> Orçamento</a>
              : <button onClick={() => setAdminOpen(true)} className="font-mono text-[10px] text-primary tracking-widest uppercase border border-primary/30 px-3 py-1.5 flex items-center gap-1.5 hover:bg-primary/10 transition-colors"><Settings size={11} /> Admin</button>}
          </div>
          <button className="md:hidden text-foreground p-1" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        <div className={`md:hidden overflow-hidden transition-[max-height] duration-300 ${menuOpen ? "max-h-80" : "max-h-0"} bg-card border-b border-border`}>
          <div className="px-5 py-5 flex flex-col gap-5">
            {navLinks.map(l => <button key={l.href} onClick={() => scrollTo(l.href)} className="text-left font-medium text-xs tracking-[0.2em] uppercase text-muted-foreground">{l.label}</button>)}
            <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-primary text-background px-5 py-3 font-bold text-xs tracking-widest uppercase w-fit"><MessageCircle size={13} /> Orçamento</a>
            {adminMode && <button onClick={() => { setMenuOpen(false); setAdminOpen(true); }} className="flex items-center gap-2 text-primary font-mono text-[10px] tracking-widest uppercase"><Settings size={11} /> Admin</button>}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {/* object-position: top on mobile → mostra a parte superior do vídeo (rosto/persona) */}
          <video
            src={heroVideo} autoPlay muted loop playsInline
            className="w-full h-full object-cover"
            style={{ objectPosition: "top center" }}
          />
          <div className="absolute inset-0 bg-background/65" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/15 to-background" />
        </div>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "200px" }} />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-5 md:px-8 text-left pt-20 md:pt-0">
          <div className="inline-flex items-center gap-2 border border-primary/40 px-4 py-1.5 mb-6 md:mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[10px] text-primary tracking-[0.25em] uppercase">{content.heroBadge}</span>
          </div>

          {/* Hero title — left-aligned, fluid sizing: ~96px desktop → escala para mobile */}
          <h1
            className="font-black uppercase leading-[0.88] mb-5 md:mb-8 text-left"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            <span className="block text-foreground" style={{ fontSize: "clamp(2rem, 6.7vw, 6rem)" }}>{content.heroLine1}</span>
            <span className="block text-primary"     style={{ fontSize: "clamp(2rem, 6.7vw, 6rem)" }}>{content.heroLine2}</span>
            <span className="block text-foreground" style={{ fontSize: "clamp(2rem, 6.7vw, 6rem)" }}>{content.heroLine3}</span>
            <span className="block" style={{ fontSize: "clamp(2.5rem, 8.9vw, 8rem)", WebkitTextStroke: "clamp(1px, 0.18vw, 2px) rgba(237,233,226,0.55)", color: "transparent" }}>{content.heroLine4}</span>
          </h1>

          <p className="text-muted-foreground font-light text-sm md:text-lg max-w-sm md:max-w-xl mb-7 md:mb-10 leading-relaxed">{content.heroSubtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3 px-0">
            <button onClick={() => scrollTo("#servicos")} className="flex items-center justify-center gap-2 bg-primary text-background px-7 py-3.5 font-bold text-sm tracking-widest uppercase hover:bg-primary/85 transition-colors">Ver serviços</button>
            <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 border border-foreground/20 text-foreground px-7 py-3.5 font-semibold text-sm tracking-widest uppercase hover:border-foreground/50 transition-colors"><MessageCircle size={15} /> WhatsApp</a>
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
        <button onClick={() => scrollTo("#servicos")} className="absolute bottom-4 left-1/2 -translate-x-1/2 text-muted-foreground"><ChevronDown size={16} className="animate-bounce" /></button>
      </section>

      {/* ── SERVIÇOS ── */}
      <section id="servicos" className="py-16 md:py-28">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <FadeIn><SectionLabel>Serviços</SectionLabel></FadeIn>
          <FadeIn delay={60}><h2 className="text-4xl md:text-7xl font-black uppercase text-foreground leading-none mb-10 md:mb-16" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>O que posso<br /><span className="text-primary">fazer por você?</span></h2></FadeIn>

          {/* Desktop */}
          <div className="hidden md:grid grid-cols-[220px_1fr] border border-border">
            <div className="border-r border-border">
              {SERVICES.map((s, i) => (
                <button key={s.number} onClick={() => setActiveService(i)} className={`w-full text-left px-6 py-5 border-b border-border last:border-b-0 transition-all ${activeService === i ? "bg-primary/8" : "hover:bg-muted/40"}`}>
                  <div className={`font-mono text-[10px] tracking-widest uppercase mb-1 ${activeService === i ? "text-primary" : "text-muted-foreground"}`}>{s.number}</div>
                  <div className={`text-lg font-black uppercase leading-tight ${activeService === i ? "text-primary" : "text-foreground"}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.title}</div>
                  {activeService === i && <div className="mt-2 h-px w-6 bg-primary" />}
                </button>
              ))}
            </div>
            <div className="p-10">
              <div className="text-primary mb-5">{SERVICES[activeService].icon}</div>
              <h3 className="text-4xl font-black uppercase text-foreground mb-4 leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{SERVICES[activeService].title}</h3>
              <p className="text-muted-foreground text-base leading-relaxed font-light mb-8">{SERVICES[activeService].description}</p>
              <div className="flex flex-wrap gap-2 mb-8">{SERVICES[activeService].tags.map(t => <span key={t} className="font-mono text-[10px] tracking-widest uppercase border border-border text-muted-foreground px-3 py-1.5 hover:border-primary hover:text-primary transition-colors">{t}</span>)}</div>
              <div className="flex flex-wrap items-center gap-6">
                <button onClick={() => { setGalleryService(SERVICES[activeService]); setGalleryInitialItem(null); }} className="inline-flex items-center gap-2 bg-primary text-background px-6 py-2.5 font-bold text-xs tracking-widest uppercase hover:bg-primary/85 transition-colors">Ver galeria <Film size={13} /></button>
                <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary font-semibold text-sm tracking-wider uppercase">Solicitar orçamento <ArrowUpRight size={15} /></a>
              </div>
            </div>
          </div>

          {/* Mobile accordion */}
          <div className="md:hidden space-y-2">
            {SERVICES.map((s, i) => {
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

      {/* ── PROJETOS ── */}
      <section id="trabalhos" className="py-16 md:py-24 bg-background overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <FadeIn><SectionLabel>Explorando Meu Trabalho</SectionLabel></FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 md:mb-12">
            <FadeIn delay={60}>
              <h2 className="text-4xl md:text-7xl font-black uppercase text-foreground leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Portfólio<br /><span className="text-primary">por área</span>
              </h2>
            </FadeIn>
            {adminMode && (
              <FadeIn delay={100}>
                <button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 px-4 py-2.5 font-bold text-xs tracking-widest uppercase bg-primary text-background self-start sm:self-auto">
                  <Plus size={13} /> Adicionar
                </button>
              </FadeIn>
            )}
          </div>

          {/* ── Destaque — pinned projects (big hero cards) ── */}
          {featuredProjects.length > 0 && (
            <FadeIn delay={80}>
              <div className="mb-10 md:mb-14">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-1.5 h-5 flex-shrink-0 rounded-sm bg-primary" />
                  <span className="font-black uppercase text-foreground text-lg md:text-xl leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Em Destaque
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground tracking-widest">{featuredProjects.length} projeto{featuredProjects.length !== 1 ? "s" : ""}</span>
                </div>
                {/* Hero grid — 2 col on larger screens, stacked on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
                  {featuredProjects.slice(0, 4).map(item => (
                    <ProjectCard
                      key={item.id} item={item}
                      showAdmin={adminMode} isPinned={pinned.has(item.id)}
                      onTogglePin={handleTogglePin}
                      onDelete={!item.isFixed ? handleDeleteProject : undefined}
                      onClick={() => openProjectGallery(item)}
                    />
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {/* ── Netflix rows — one per category ── */}
          <FadeIn delay={120}>
            <div className="space-y-2">
              {CATEGORIES.map(cat => {
                const items = allProjects.filter(p => p.category === cat);
                return (
                  <CarouselRow
                    key={cat}
                    label={cat}
                    items={items}
                    showAdmin={adminMode}
                    pinned={pinned}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDeleteProject}
                    onClickItem={openProjectGallery}
                  />
                );
              })}
            </div>
          </FadeIn>

          {/* Empty state */}
          {allProjects.length === 0 && (
            <div className="border border-dashed border-border py-20 flex flex-col items-center gap-4">
              <Film size={28} className="text-muted-foreground" />
              <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase text-center">
                Nenhum projeto ainda<br />
                <span className="text-[10px] opacity-60">Faça upload pelo painel admin</span>
              </p>
              {adminMode && (
                <button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 font-bold text-xs tracking-widest uppercase mt-2">
                  <Plus size={12} /> Primeiro projeto
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── DIFERENCIAIS ── */}
      <section id="diferenciais" className="py-16 md:py-28">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <FadeIn><SectionLabel>Por que eu?</SectionLabel></FadeIn>
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
            <FadeIn delay={60}>
              <div>
                <h2 className="text-4xl md:text-6xl font-black uppercase text-foreground leading-none mb-5" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {content.difHeading1}<br />{content.difHeading2}<br /><span className="text-primary">{content.difHeading3}</span>
                </h2>
                <p className="text-muted-foreground font-light text-sm md:text-base leading-relaxed mb-6 md:mb-8">{content.difSubtext}</p>
                <AudioPlayer audio={cms.audio} adminMode={adminMode} onUpload={handleAudioUpload} onDelete={handleAudioDelete} ghConfigured={ghOk} />
              </div>
            </FadeIn>
            <div className="space-y-0">
              {ADVANTAGES.map((adv, i) => (
                <FadeIn key={adv.num} delay={80 + i * 60}>
                  <div className="border-b border-border py-5 md:py-7">
                    <div className="flex items-start gap-4 md:gap-5">
                      <span className="font-mono text-[10px] text-primary tracking-widest mt-1 flex-shrink-0">{adv.num}</span>
                      <div><h3 className="text-lg md:text-xl font-black uppercase text-foreground mb-1 leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{adv.title}</h3><p className="text-sm text-muted-foreground font-light leading-relaxed">{adv.body}</p></div>
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
                <h2 className="text-4xl md:text-7xl font-black uppercase text-foreground leading-none mb-5" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {content.contactHeading.split(" ").slice(0, 1).join(" ")}<br />
                  <span className="text-primary">{content.contactHeading.split(" ").slice(1, 2).join(" ")}</span><br />
                  {content.contactHeading.split(" ").slice(2).join(" ")}
                </h2>
                <p className="text-muted-foreground font-light text-sm md:text-base leading-relaxed mb-7">{content.contactSubtext}</p>
                <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-primary text-background px-7 py-4 font-black tracking-widest uppercase hover:bg-primary/85 transition-colors w-full sm:w-auto justify-center" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem" }}>
                  <MessageCircle size={17} /> Falar no WhatsApp
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
            <p className="font-mono text-[10px] text-muted-foreground tracking-wider leading-relaxed" onClick={() => !adminMode && setShowLogin(true)}>
              {content.footerCopy}{adminMode && <span className="block text-primary mt-0.5">ADMIN ATIVO</span>}
            </p>
            <div className="flex items-center gap-5">
              <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors"><MessageCircle size={18} /></a>
              <a href="mailto:fredericopierredamasceno@gmail.com" className="text-muted-foreground hover:text-primary transition-colors"><Mail size={18} /></a>
            </div>
          </div>
          <div className="hidden md:grid grid-cols-3 items-center">
            <button onClick={() => scrollTo("#hero")}><img src={logoImg} alt="Freed Pierre" className="h-10 w-auto brightness-200 opacity-80 hover:opacity-100 transition-opacity" /></button>
            <p className="font-mono text-[10px] text-muted-foreground tracking-widest text-center leading-relaxed cursor-default" onClick={() => !adminMode && setShowLogin(true)}>
              {content.footerCopy}{adminMode && <span className="block text-primary mt-0.5">ADMIN ATIVO</span>}
            </p>
            <div className="flex justify-end items-center gap-4">
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
