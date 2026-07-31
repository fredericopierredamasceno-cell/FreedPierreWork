import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mail, Phone, Menu, X, ChevronDown,
  Mic, Film, Palette, MessageCircle, ArrowUpRight,
  Play, Pause, Upload, Trash2, Plus, ImageIcon, VideoIcon,
  Check, Music, LogOut, Lock, Eye, EyeOff, Sparkles,
  Settings, FileText, Paintbrush, FolderOpen, Info,
  Pin, PinOff, Github, RefreshCw, AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import heroVideo from "../imports/Portf_lio_Video_Final_Ver.mp4";
import pizzaVideo from "../imports/Lan_amento_Pizza_Ifood.mp4";
import logoImg from "../imports/Logo_Freed_Pierre.png";

/* ─────────────────────────────────────────────────────────────────
   GITHUB CMS SERVICE
   Toda persistência passa pela GitHub REST API.
   O arquivo public/cms-data.json no repositório é a "base de dados".
   Uploads vão para public/uploads/{images|videos|audio}/.
   Netlify detecta cada commit e faz deploy automático.
───────────────────────────────────────────────────────────────────*/

const CMS_FILE = "public/cms-data.json";
const GH_CFG_KEY = "fp_gh_cfg"; // sessionStorage — token de segurança, não é conteúdo

interface GitHubConfig {
  owner: string; // usuário ou organização do GitHub
  repo: string;  // nome do repositório
  branch: string; // branch (ex: "main")
  token: string; // Personal Access Token com permissão "repo"
}

function loadGHConfig(): GitHubConfig | null {
  try { const s = sessionStorage.getItem(GH_CFG_KEY); return s ? JSON.parse(s) : null; }
  catch { return null; }
}
function storeGHConfig(cfg: GitHubConfig) {
  sessionStorage.setItem(GH_CFG_KEY, JSON.stringify(cfg));
}

const GH = (cfg: GitHubConfig, path: string) =>
  `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
});

async function ghGetSHA(cfg: GitHubConfig, path: string): Promise<string | undefined> {
  try {
    const r = await fetch(`${GH(cfg, path)}?ref=${cfg.branch}`, { headers: GH_HEADERS(cfg.token) });
    if (r.ok) return (await r.json()).sha;
  } catch {}
  return undefined;
}

async function ghCommitJSON(cfg: GitHubConfig, data: object, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const sha = await ghGetSHA(cfg, CMS_FILE);
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body: Record<string, unknown> = { message, content, branch: cfg.branch };
    if (sha) body.sha = sha;
    const r = await fetch(GH(cfg, CMS_FILE), { method: "PUT", headers: GH_HEADERS(cfg.token), body: JSON.stringify(body) });
    if (r.ok) return { ok: true };
    const e = await r.json().catch(() => ({}));
    return { ok: false, error: (e as Record<string,string>).message || `HTTP ${r.status}` };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede." };
  }
}

async function ghUploadBinary(cfg: GitHubConfig, folder: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safe}`;
  const path = `${folder}/${filename}`;
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // chunk to avoid stack overflow on large files
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)));
  const content = btoa(binary);
  const sha = await ghGetSHA(cfg, path);
  const body: Record<string, unknown> = { message: `Upload: ${file.name}`, content, branch: cfg.branch };
  if (sha) body.sha = sha;
  const r = await fetch(GH(cfg, path), { method: "PUT", headers: GH_HEADERS(cfg.token), body: JSON.stringify(body) });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as Record<string,string>).message || `HTTP ${r.status}`);
  }
  // return public URL path relative to site root
  return `/${path.replace(/^public\//, "")}`;
}

async function ghDeleteFile(cfg: GitHubConfig, publicPath: string): Promise<void> {
  // publicPath is like /uploads/images/foo.jpg → public/uploads/images/foo.jpg
  const repoPath = `public${publicPath}`;
  const sha = await ghGetSHA(cfg, repoPath);
  if (!sha) return;
  await fetch(GH(cfg, repoPath), {
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
    return { ok: false, error: (e as Record<string,string>).message || `HTTP ${r.status}` };
  } catch (e: unknown) { return { ok: false, error: e instanceof Error ? e.message : "Erro de rede." }; }
}

/* ─── Types ─────────────────────────────────────────────────────── */

interface CMSProject {
  id: string; title: string; description: string; category: string;
  mediaType: "image" | "video"; mediaUrl: string; thumbUrl?: string;
  isFixed?: boolean; createdAt: number;
}
type DisplayProject = CMSProject;

interface CMSData {
  content: SiteContent;
  theme: SiteTheme;
  projects: CMSProject[];
  pinned: string[];
  hiddenSeeds: string[];
  audio: { name: string; url: string } | null;
  updatedAt: string;
}

/* ─── Content / Theme defaults ───────────────────────────────────── */

const CONTENT_DEFAULTS = {
  heroLine1: "ONDE ÁUDIO,", heroLine2: "DESIGN", heroLine3: "E MOVIMENTOS", heroLine4: "SE ENCONTRAM",
  heroBadge: "Disponível para projetos",
  heroSubtitle: "Um profissional. Quatro linguagens. Design, motion, vídeo e produção fonográfica para marcas, artistas e conteúdo digital.",
  stat1Val: "10+", stat1Label: "Anos de experiência",
  stat2Val: "4",   stat2Label: "Áreas de atuação",
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
    content: { ...CONTENT_DEFAULTS },
    theme: { ...THEME_DEFAULTS },
    projects: [],
    pinned: ["seed-pizza"],
    hiddenSeeds: [],
    audio: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/* ─── Central CMS hook ───────────────────────────────────────────── */

type SaveStatus = "idle" | "saving" | "success" | "error";

function useCMS() {
  const [ghConfig, setGhConfigState] = useState<GitHubConfig | null>(loadGHConfig);
  const [cms, setCms] = useState<CMSData>(makeCMSData);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");

  // Apply theme CSS vars whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cms.theme).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  }, [cms.theme]);

  // Load from /cms-data.json on startup
  useEffect(() => {
    fetch(`/cms-data.json?t=${Date.now()}`)
      .then(r => { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then((d: Partial<CMSData>) => {
        setCms(makeCMSData(d));
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, []);

  const setGhConfig = useCallback((cfg: GitHubConfig) => {
    storeGHConfig(cfg);
    setGhConfigState(cfg);
  }, []);

  const clearGhConfig = useCallback(() => {
    sessionStorage.removeItem(GH_CFG_KEY);
    setGhConfigState(null);
  }, []);

  // Publish entire cms state to GitHub
  const publish = useCallback(async (data: CMSData): Promise<boolean> => {
    if (!ghConfig) { setSaveError("Configure o GitHub primeiro (aba GitHub)."); setSaveStatus("error"); return false; }
    setSaveStatus("saving"); setSaveError("");
    const payload = { ...data, updatedAt: new Date().toISOString() };
    const result = await ghCommitJSON(ghConfig, payload, "CMS: Atualização de conteúdo");
    if (result.ok) {
      setCms(payload);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 5000);
      return true;
    } else {
      setSaveStatus("error");
      setSaveError(result.error || "Erro ao publicar.");
      return false;
    }
  }, [ghConfig]);

  // Upload a file to the repo and return its public URL
  const uploadFile = useCallback(async (file: File, type: "image" | "video" | "audio"): Promise<string | null> => {
    if (!ghConfig) { setSaveError("Configure o GitHub primeiro (aba GitHub)."); return null; }
    const folder = type === "image" ? "public/uploads/images" : type === "video" ? "public/uploads/videos" : "public/uploads/audio";
    setUploadMsg(`Enviando ${file.name}...`);
    try {
      const url = await ghUploadBinary(ghConfig, folder, file);
      setUploadMsg("");
      return url;
    } catch (e: unknown) {
      setUploadMsg("");
      setSaveError(e instanceof Error ? e.message : "Erro no upload.");
      setSaveStatus("error");
      return null;
    }
  }, [ghConfig]);

  // Delete a file from the repo
  const deleteFile = useCallback(async (publicPath: string): Promise<void> => {
    if (!ghConfig || !publicPath.startsWith("/uploads/")) return;
    try { await ghDeleteFile(ghConfig, publicPath); } catch {}
  }, [ghConfig]);

  return {
    ghConfig, setGhConfig, clearGhConfig,
    cms, setCms,
    loading, saveStatus, saveError, uploadMsg,
    publish, uploadFile, deleteFile,
  };
}

/* ─── Admin auth ─────────────────────────────────────────────────── */

const ADMIN_USER = "freed";
const ADMIN_PASS = "pierre2026";
const SESSION_KEY = "fp_admin_session";
function checkSession() { return sessionStorage.getItem(SESSION_KEY) === "1"; }

/* ─── Seed items (code-bundled, not in CMS) ─────────────────────── */

const ALL_SEEDS: DisplayProject[] = [
  {
    id: "seed-pizza", category: "Motion Design",
    title: "Motion Lançamento de Pizzas", isFixed: true,
    description: "🍕✨ Motion Design desenvolvido para o Grupo Beija-flor, promovendo novidades do cardápio da unidade de Jardim Teresópolis, Betim/MG.\n\nCada animação, transição e detalhe foi pensado para valorizar o produto e criar uma comunicação dinâmica, moderna, envolvente e com apelo comercial.\n\n🎬 Mais um trabalho que tive grande satisfação em desenvolver.",
    mediaType: "video", mediaUrl: pizzaVideo, createdAt: 0,
  },
];

/* ─── Constants ─────────────────────────────────────────────────── */

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

/* ─── Utility hooks ─────────────────────────────────────────────── */

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const fn = () => { const el = document.documentElement; const max = el.scrollHeight - el.clientHeight; setP(max > 0 ? el.scrollTop / max : 0); };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
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

/* ─── Shared UI ─────────────────────────────────────────────────── */

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-10 md:mb-14">
      <span className="font-mono text-[10px] text-muted-foreground tracking-[0.3em] uppercase">—</span>
      <span className="font-mono text-[10px] text-muted-foreground tracking-[0.3em] uppercase">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

/* ─── AdminLoginModal ────────────────────────────────────────────── */

function AdminLoginModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [user, setUser] = useState(""); const [pass, setPass] = useState(""); const [showPass, setShowPass] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!open) { setUser(""); setPass(""); setError(""); } else document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, [open]);
  const handleLogin = () => { if (user === ADMIN_USER && pass === ADMIN_PASS) { sessionStorage.setItem(SESSION_KEY, "1"); onSuccess(); onClose(); } else setError("Usuário ou senha incorretos."); };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div><div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">Painel Administrativo</div><h2 className="text-2xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Entrar</h2></div>
          <Lock size={18} className="text-muted-foreground" />
        </div>
        <div className="p-6 space-y-4">
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Usuário</label><input value={user} onChange={(e) => setUser(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" autoComplete="username" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Senha</label>
            <div className="relative"><input type={showPass ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} className="w-full bg-muted border border-border px-4 py-3 pr-11 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" autoComplete="current-password" />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>
          {error && <p className="font-mono text-[10px] text-red-400 tracking-wider">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Cancelar</button>
          <button onClick={handleLogin} className="flex items-center gap-2 bg-primary text-background px-6 py-2.5 font-bold text-xs tracking-widest uppercase"><Lock size={12} /> Entrar</button>
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
  const [hovered, setHovered] = useState(false);
  const handleEnter = () => {
    setHovered(true);
    if (item.mediaType === "video" && videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play().catch(() => {}); }
  };
  const handleLeave = () => {
    setHovered(false);
    if (item.mediaType === "video" && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  };
  return (
    <div className="relative bg-card group overflow-hidden aspect-video cursor-pointer" onMouseEnter={handleEnter} onMouseLeave={handleLeave} onClick={onClick}>
      {item.mediaType === "video"
        ? <video ref={videoRef} src={item.mediaUrl} muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        : <img src={item.mediaUrl} alt={item.title} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${hovered ? "scale-105" : "scale-100"}`} />}
      {item.thumbUrl && !hovered && <img src={item.thumbUrl} alt="capa" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-1">{item.category}</div>
        <h3 className="text-lg md:text-xl font-black uppercase text-foreground leading-tight drop-shadow-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{item.title}</h3>
      </div>
      {item.mediaType === "video" && <div className={`absolute top-3 right-3 w-7 h-7 bg-primary/90 flex items-center justify-center transition-opacity ${hovered ? "opacity-0" : "opacity-80"}`}><Play size={10} className="text-background ml-0.5" /></div>}
      <div className={`absolute inset-0 border-2 border-primary transition-opacity pointer-events-none ${hovered ? "opacity-40" : "opacity-0"}`} />
      {showAdmin && (
        <div className="absolute top-3 left-3 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onTogglePin && (
            <button onClick={() => onTogglePin(item.id)} className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-mono tracking-wider uppercase border transition-colors ${isPinned ? "bg-primary text-background border-primary" : "bg-background/80 text-muted-foreground border-border hover:border-primary hover:text-primary"}`}>
              {isPinned ? <><Pin size={10} /> Fixado</> : <><PinOff size={10} /> Fixar</>}
            </button>
          )}
          {onDelete && !item.isFixed && (
            <button onClick={() => onDelete(item.id)} className="flex items-center gap-1 px-2 py-1.5 bg-background/80 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition-colors">
              <Trash2 size={10} /><span className="font-mono text-[10px] tracking-wider uppercase">Del</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── UploadModal ────────────────────────────────────────────────── */

function UploadModal({ open, onClose, onSave, uploadFile, ghConfigured }: {
  open: boolean; onClose: () => void;
  onSave: (proj: CMSProject) => Promise<void>;
  uploadFile: (f: File, type: "image" | "video" | "audio") => Promise<string | null>;
  ghConfigured: boolean;
}) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [category, setCategory] = useState(CATEGORIES[0]);
  const [mediaFile, setMediaFile] = useState<File | null>(null); const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [step, setStep] = useState<"idle" | "uploading" | "saving" | "done" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", fn); document.body.style.overflow = ""; };
  }, [open, onClose]);

  const reset = () => { setTitle(""); setDescription(""); setCategory(CATEGORIES[0]); setMediaFile(null); setThumbFile(null); setStep("idle"); setStatusMsg(""); };
  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (!mediaFile || !title.trim() || !ghConfigured) return;
    const mediaType = mediaFile.type.startsWith("video") ? "video" : "image";
    const uploadFolder = mediaType === "video" ? "video" : "image";

    setStep("uploading"); setStatusMsg(`Enviando arquivo principal para o GitHub...`);
    const mediaUrl = await uploadFile(mediaFile, uploadFolder);
    if (!mediaUrl) { setStep("error"); setStatusMsg("Falha no upload. Verifique a configuração do GitHub."); return; }

    let thumbUrl: string | undefined;
    if (thumbFile) {
      setStatusMsg("Enviando thumbnail...");
      const tu = await uploadFile(thumbFile, "image");
      if (tu) thumbUrl = tu;
    }

    setStep("saving"); setStatusMsg("Salvando projeto...");
    await onSave({ id: `proj-${Date.now()}`, title: title.trim(), description: description.trim(), category, mediaType, mediaUrl, thumbUrl, createdAt: Date.now() });
    setStep("done"); setStatusMsg("Publicado com sucesso!");
    setTimeout(() => { reset(); onClose(); }, 1500);
  };

  if (!open) return null;
  const busy = step === "uploading" || step === "saving";

  return (
    <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-xl bg-card border border-border border-b-0 sm:border-b flex flex-col max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div><div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">Novo Projeto</div><h2 className="text-xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Upload para GitHub</h2></div>
          <button onClick={handleClose} className="w-9 h-9 flex items-center justify-center border border-border text-muted-foreground"><X size={15} /></button>
        </div>

        {!ghConfigured && (
          <div className="mx-5 mt-5 flex items-start gap-3 border border-amber-500/30 bg-amber-500/5 p-4">
            <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/80 font-light">Configure o GitHub no Painel Admin (aba GitHub) antes de fazer uploads.</p>
          </div>
        )}

        <div className="p-5 space-y-4">
          <div>
            <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Arquivo Principal * (Imagem ou Vídeo)</label>
            <div className={`border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${mediaFile ? "border-primary bg-primary/5" : "border-border"}`} onClick={() => document.getElementById("media-inp-u")?.click()}>
              <input id="media-inp-u" type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setMediaFile(f); }} />
              {mediaFile ? <div className="flex items-center justify-center gap-2 text-primary">{mediaFile.type.startsWith("video") ? <VideoIcon size={16} /> : <ImageIcon size={16} />}<span className="text-sm truncate max-w-[200px]">{mediaFile.name}</span><span className="font-mono text-[10px] text-muted-foreground">({(mediaFile.size / 1024 / 1024).toFixed(1)}MB)</span></div>
                : <div className="flex flex-col items-center gap-2 text-muted-foreground"><Upload size={20} /><span className="text-xs font-mono tracking-wider uppercase">Toque ou arraste</span><span className="text-[10px] text-muted-foreground/60 font-mono">Máx. 25MB via GitHub API</span></div>}
            </div>
            {mediaFile && mediaFile.size > 25 * 1024 * 1024 && <p className="font-mono text-[10px] text-red-400 mt-1">⚠ Arquivo maior que 25MB pode falhar na API do GitHub.</p>}
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Thumbnail (opcional)</label>
            <div className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${thumbFile ? "border-primary bg-primary/5" : "border-border"}`} onClick={() => document.getElementById("thumb-inp-u")?.click()}>
              <input id="thumb-inp-u" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setThumbFile(f); }} />
              {thumbFile ? <div className="flex items-center justify-center gap-2 text-primary"><ImageIcon size={14} /><span className="text-sm truncate max-w-[180px]">{thumbFile.name}</span></div>
                : <div className="flex items-center justify-center gap-2 text-muted-foreground"><ImageIcon size={14} /><span className="text-xs font-mono tracking-wider uppercase">Capa</span></div>}
            </div>
          </div>
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Título *</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do projeto" className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Descrição</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Categoria</label>
            <div className="grid grid-cols-2 gap-2">{CATEGORIES.map((cat) => <button key={cat} onClick={() => setCategory(cat)} className={`font-mono text-[10px] tracking-widest uppercase px-3 py-2.5 border transition-colors text-left ${category === cat ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{cat}</button>)}</div></div>
        </div>

        {statusMsg && (
          <div className={`mx-5 mb-4 flex items-center gap-2 text-sm font-mono ${step === "error" ? "text-red-400" : step === "done" ? "text-green-400" : "text-primary"}`}>
            {busy && <Loader2 size={13} className="animate-spin" />}
            {step === "done" && <CheckCircle2 size={13} />}
            {step === "error" && <AlertCircle size={13} />}
            {statusMsg}
          </div>
        )}

        <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <button onClick={handleClose} className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Cancelar</button>
          <button onClick={handleSave} disabled={!mediaFile || !title.trim() || busy || !ghConfigured} className={`flex items-center gap-2 px-6 py-3 font-bold text-xs tracking-widest uppercase transition-all ${step === "done" ? "bg-green-600 text-white" : !mediaFile || !title.trim() || !ghConfigured ? "bg-muted text-muted-foreground cursor-not-allowed" : busy ? "bg-primary/60 text-background" : "bg-primary text-background"}`}>
            {busy ? <><Loader2 size={13} className="animate-spin" /> {step === "uploading" ? "Enviando..." : "Salvando..."}</> : step === "done" ? <><Check size={13} /> Publicado!</> : <><Upload size={13} /> Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── GalleryModal ───────────────────────────────────────────────── */

function GalleryModal({ service, allProjects, initialItem, onClose, showAdmin, onDelete, onTogglePin, pinned }: {
  service: typeof SERVICES[number] | null; allProjects: DisplayProject[];
  initialItem?: DisplayProject | null; onClose: () => void;
  showAdmin: boolean; onDelete: (id: string) => void;
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
  const items = allProjects.filter((p) => service.galleryCategories.includes(p.category));

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" onClick={() => { if (selected) setSelected(null); else onClose(); }}>
      <div className="absolute inset-0 bg-background/93 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-5xl max-h-[95vh] sm:max-h-[92vh] flex flex-col bg-card border border-border border-b-0 sm:border-b overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
              <div className="bg-black flex items-center justify-center" style={{ minHeight: "min(50vw, 280px)" }}>
                {selected.mediaType === "video" ? <video src={selected.mediaUrl} controls autoPlay muted loop playsInline className="w-full h-full object-contain max-h-[50vh] md:max-h-none" /> : <img src={selected.mediaUrl} alt={selected.title} className="w-full h-full object-contain max-h-[50vh]" />}
              </div>
              <div className="border-t md:border-t-0 md:border-l border-border p-5 md:p-7 flex flex-col gap-4">
                <div><div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-1.5">{selected.category}</div><h3 className="text-xl md:text-2xl font-black uppercase text-foreground leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{selected.title}</h3></div>
                {selected.description && <div className="border-t border-border pt-4"><div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-2">Sobre o projeto</div><p className="text-sm text-muted-foreground leading-relaxed font-light whitespace-pre-line">{selected.description}</p></div>}
                <div className="mt-auto pt-4 border-t border-border space-y-3">
                  <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-primary text-background px-5 py-3 font-bold text-xs tracking-widest uppercase w-full justify-center md:w-fit"><MessageCircle size={13} /> Solicitar projeto similar</a>
                  {showAdmin && (
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => onTogglePin(selected.id)} className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] tracking-wider uppercase border transition-colors ${pinned.has(selected.id) ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                        {pinned.has(selected.id) ? <><Pin size={10} /> Em destaque</> : <><PinOff size={10} /> Fixar no destaque</>}
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
              {items.map((item) => <ProjectCard key={item.id} item={item} showAdmin={showAdmin} isPinned={pinned.has(item.id)} onTogglePin={onTogglePin} onDelete={!item.isFixed ? onDelete : undefined} onClick={() => setSelected(item)} />)}
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

/* ─── AudioPlayer ────────────────────────────────────────────────── */

function AudioPlayer({ audio, adminMode, onUpload, onDelete, ghConfigured }: {
  audio: { name: string; url: string } | null; adminMode: boolean;
  onUpload: (f: File) => void; onDelete: () => void; ghConfigured: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false); const [progress, setProgress] = useState(0); const [duration, setDuration] = useState(0);
  const toggle = () => { const el = audioRef.current; if (!el) return; if (playing) { el.pause(); setPlaying(false); } else { el.play(); setPlaying(true); } };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <div className="border border-border">
      {audio && <audio ref={audioRef} src={audio.url} onTimeUpdate={() => { const el = audioRef.current; if (el) setProgress(el.currentTime / (el.duration || 1)); }} onLoadedMetadata={() => { const el = audioRef.current; if (el) setDuration(el.duration); }} onEnded={() => setPlaying(false)} />}
      <div className="p-4 flex items-center gap-4">
        <button onClick={toggle} disabled={!audio} className="w-10 h-10 flex-shrink-0 bg-primary flex items-center justify-center text-background disabled:opacity-40">{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-1">{audio ? "Demo" : "Nenhum áudio"}</div>
          <div className="text-sm font-semibold text-foreground truncate mb-2">{audio ? audio.name.replace(/\.[^.]+$/, "") : "—"}</div>
          {audio && <div className="flex items-center gap-2"><div className="flex-1 h-1 bg-muted rounded-full overflow-hidden cursor-pointer" onClick={(e) => { const el = audioRef.current; if (!el) return; const rect = e.currentTarget.getBoundingClientRect(); el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration; }}><div className="h-full bg-primary rounded-full" style={{ width: `${progress * 100}%` }} /></div><span className="font-mono text-[10px] text-muted-foreground">{fmt(duration)}</span></div>}
        </div>
      </div>
      {adminMode && (
        <div className="border-t border-border px-4 py-3 flex items-center gap-3 flex-wrap">
          <label className={`flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase ${ghConfigured ? "cursor-pointer text-primary" : "cursor-not-allowed text-muted-foreground"}`}>
            <Music size={12} />{audio ? "Trocar áudio" : "Upload de áudio"}
            {ghConfigured && <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); setPlaying(false); setProgress(0); } }} />}
          </label>
          {audio && <button onClick={() => { setPlaying(false); setProgress(0); onDelete(); }} className="flex items-center gap-1 text-red-400 font-mono text-[10px] tracking-widest uppercase ml-auto"><Trash2 size={11} /> Remover</button>}
        </div>
      )}
    </div>
  );
}

/* ─── GitHubConfigTab ────────────────────────────────────────────── */

function GitHubConfigTab({ ghConfig, onSave, onClear, onPublish, cms, saveStatus, saveError, uploadMsg }: {
  ghConfig: GitHubConfig | null;
  onSave: (cfg: GitHubConfig) => void;
  onClear: () => void;
  onPublish: () => void;
  cms: CMSData;
  saveStatus: SaveStatus;
  saveError: string;
  uploadMsg: string;
}) {
  const [owner, setOwner] = useState(ghConfig?.owner ?? "");
  const [repo, setRepo] = useState(ghConfig?.repo ?? "");
  const [branch, setBranch] = useState(ghConfig?.branch ?? "main");
  const [token, setToken] = useState(ghConfig?.token ?? "");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null);

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    const r = await ghTestConnection({ owner, repo, branch, token });
    setTestResult(r); setTesting(false);
  };
  const handleSave = () => onSave({ owner, repo, branch, token });

  const statusColor = saveStatus === "success" ? "text-green-400" : saveStatus === "error" ? "text-red-400" : "text-primary";
  const statusIcon = saveStatus === "saving" ? <Loader2 size={12} className="animate-spin" /> : saveStatus === "success" ? <CheckCircle2 size={12} /> : saveStatus === "error" ? <AlertCircle size={12} /> : null;

  return (
    <div className="space-y-5">
      {/* Publish action */}
      <div className="border border-border p-4">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-3">Publicar no GitHub + Netlify</div>
        <p className="text-sm text-muted-foreground font-light mb-4">Clique para salvar todas as alterações no repositório. A Netlify detectará o commit e publicará automaticamente.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onPublish} disabled={!ghConfig || saveStatus === "saving"} className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs tracking-widest uppercase transition-all ${!ghConfig ? "bg-muted text-muted-foreground cursor-not-allowed" : saveStatus === "saving" ? "bg-primary/60 text-background" : "bg-primary text-background hover:bg-primary/85"}`}>
            {saveStatus === "saving" ? <><Loader2 size={12} className="animate-spin" /> Publicando...</> : <><Github size={12} /> Publicar agora</>}
          </button>
          {(saveStatus !== "idle" || saveError || uploadMsg) && (
            <span className={`flex items-center gap-1.5 font-mono text-[10px] uppercase ${statusColor}`}>
              {statusIcon}
              {uploadMsg || saveError || (saveStatus === "success" ? "Publicado! Deploy em andamento (~2min)..." : "")}
            </span>
          )}
        </div>
        {!ghConfig && <p className="font-mono text-[10px] text-amber-400 mt-3">⚠ Configure o GitHub abaixo antes de publicar.</p>}
      </div>

      {/* GitHub config */}
      <div className="border border-border p-4 space-y-4">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase">Configuração do GitHub</div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-1.5">Usuário / Org</label><input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="freed-pierre" className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-1.5">Repositório</label><input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="portfolio" className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" /></div>
        </div>
        <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-1.5">Branch</label><input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" /></div>
        <div>
          <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-1.5">Personal Access Token (PAT)</label>
          <div className="relative">
            <input type={showToken ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_..." className="w-full bg-muted border border-border px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
            <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showToken ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/60 mt-1 tracking-wider">O token é armazenado apenas durante esta sessão e apagado ao fechar o navegador.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleTest} disabled={!owner || !repo || !token || testing} className="flex items-center gap-2 border border-border px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
            {testing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Testar conexão
          </button>
          <button onClick={handleSave} disabled={!owner || !repo || !token} className="flex items-center gap-2 bg-primary text-background px-4 py-2 font-bold text-[10px] tracking-widest uppercase hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Check size={11} /> Salvar config
          </button>
          {ghConfig && <button onClick={onClear} className="font-mono text-[10px] text-red-400 tracking-widest uppercase">Limpar</button>}
        </div>
        {testResult && (
          <div className={`flex items-center gap-2 font-mono text-[10px] ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
            {testResult.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {testResult.ok ? `Conectado: ${testResult.name}` : testResult.error}
          </div>
        )}
      </div>

      {/* How-to guide */}
      <div className="border border-border p-4">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-3">Como criar um Token (PAT)</div>
        <ol className="text-sm text-muted-foreground font-light space-y-1.5 list-decimal list-inside">
          <li>Acesse <span className="text-primary font-mono text-xs">github.com → Settings → Developer settings</span></li>
          <li>Clique em <span className="text-foreground">Personal access tokens → Tokens (classic)</span></li>
          <li>Clique em <span className="text-foreground">Generate new token (classic)</span></li>
          <li>Selecione o escopo <span className="text-primary font-mono text-xs">repo</span> (acesso completo ao repositório)</li>
          <li>Gere e copie o token — cole no campo acima</li>
        </ol>
      </div>

      {/* Status summary */}
      <div className="border border-border p-4 space-y-2">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-2">Status do CMS</div>
        <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full inline-block ${ghConfig ? "bg-green-500" : "bg-amber-500"}`} /><span className="font-mono text-[10px] text-muted-foreground">{ghConfig ? `Conectado: ${ghConfig.owner}/${ghConfig.repo}` : "Não configurado"}</span></div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full inline-block bg-primary" /><span className="font-mono text-[10px] text-muted-foreground">{cms.projects.length} upload{cms.projects.length !== 1 ? "s" : ""} · atualizado {new Date(cms.updatedAt).toLocaleString("pt-BR")}</span></div>
      </div>
    </div>
  );
}

/* ─── AdminPanel ─────────────────────────────────────────────────── */

type AdminTab = "github" | "uploads" | "textos" | "cores" | "info";

function AdminPanel({ open, onClose, cms, setCms, publish, uploadFile, deleteFile, ghConfig, setGhConfig, clearGhConfig, saveStatus, saveError, uploadMsg, onOpenUpload }: {
  open: boolean; onClose: () => void;
  cms: CMSData; setCms: (d: CMSData) => void;
  publish: (d: CMSData) => Promise<boolean>;
  uploadFile: (f: File, t: "image" | "video" | "audio") => Promise<string | null>;
  deleteFile: (path: string) => Promise<void>;
  ghConfig: GitHubConfig | null;
  setGhConfig: (c: GitHubConfig) => void;
  clearGhConfig: () => void;
  saveStatus: SaveStatus; saveError: string; uploadMsg: string;
  onOpenUpload: () => void;
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

  const togglePin = (id: string) => {
    const next = pinned.has(id) ? cms.pinned.filter(p => p !== id) : [...cms.pinned, id];
    setCms({ ...cms, pinned: next });
  };
  const toggleHideSeed = (id: string) => {
    if (hiddenSeeds.has(id)) {
      setCms({ ...cms, hiddenSeeds: cms.hiddenSeeds.filter(s => s !== id) });
    } else {
      setCms({ ...cms, hiddenSeeds: [...cms.hiddenSeeds, id], pinned: cms.pinned.filter(p => p !== id) });
    }
  };
  const deleteUpload = async (id: string) => {
    if (!confirm("Remover este projeto?")) return;
    const proj = cms.projects.find(p => p.id === id);
    if (proj) {
      if (proj.mediaUrl.startsWith("/uploads/")) await deleteFile(proj.mediaUrl);
      if (proj.thumbUrl?.startsWith("/uploads/")) await deleteFile(proj.thumbUrl);
    }
    setCms({ ...cms, projects: cms.projects.filter(p => p.id !== id), pinned: cms.pinned.filter(p => p !== id) });
  };
  const saveEdit = async (id: string) => {
    setSaving(true);
    const updated = cms.projects.map(p => p.id === id ? { ...p, title: editTitle, description: editDesc, category: editCat } : p);
    setCms({ ...cms, projects: updated });
    setSaving(false); setSavedId(id);
    setTimeout(() => { setSavedId(null); setEditingId(null); }, 800);
  };
  const updateContent = (key: keyof SiteContent, value: string) => setCms({ ...cms, content: { ...cms.content, [key]: value } });
  const updateTheme = (key: keyof SiteTheme, value: string) => setCms({ ...cms, theme: { ...cms.theme, [key]: value } });

  const TABS: { id: AdminTab; icon: React.ReactNode; label: string }[] = [
    { id: "github", icon: <Github size={13} />, label: "GitHub" },
    { id: "uploads", icon: <FolderOpen size={13} />, label: "Uploads" },
    { id: "textos", icon: <FileText size={13} />, label: "Textos" },
    { id: "cores", icon: <Paintbrush size={13} />, label: "Cores" },
    { id: "info", icon: <Info size={13} />, label: "Info" },
  ];

  const contentFields: { key: keyof SiteContent; label: string; multi?: boolean }[] = [
    { key: "heroLine1", label: "Hero — Linha 1" }, { key: "heroLine2", label: "Hero — Linha 2 (branca)" },
    { key: "heroLine3", label: "Hero — Linha 3" }, { key: "heroLine4", label: "Hero — Linha 4 (laranja)" },
    { key: "heroBadge", label: "Badge" }, { key: "heroSubtitle", label: "Subtítulo", multi: true },
    { key: "stat1Val", label: "Stat 1 — Valor" }, { key: "stat1Label", label: "Stat 1 — Legenda" },
    { key: "stat2Val", label: "Stat 2 — Valor" }, { key: "stat2Label", label: "Stat 2 — Legenda" },
    { key: "stat3Val", label: "Stat 3 — Valor" }, { key: "stat3Label", label: "Stat 3 — Legenda" },
    { key: "stat4Val", label: "Stat 4 — Valor" }, { key: "stat4Label", label: "Stat 4 — Legenda" },
    { key: "difHeading1", label: "Dif. — Linha 1" }, { key: "difHeading2", label: "Dif. — Linha 2" }, { key: "difHeading3", label: "Dif. — Linha 3" },
    { key: "difSubtext", label: "Dif. — Parágrafo", multi: true },
    { key: "contactHeading", label: "Contato — Título" }, { key: "contactSubtext", label: "Contato — Sub", multi: true },
    { key: "footerCopy", label: "Rodapé" },
  ];

  const themeFields: { key: keyof SiteTheme; label: string }[] = [
    { key: "primary", label: "Cor de destaque (laranja)" },
    { key: "background", label: "Fundo" },
    { key: "foreground", label: "Texto" },
    { key: "card", label: "Fundo cards" },
    { key: "muted", label: "Superfície secundária" },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-3xl max-h-[96vh] md:max-h-[92vh] flex flex-col bg-card border border-border border-b-0 md:border-b" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-primary" />
            <span className="font-mono text-[10px] text-primary tracking-widest uppercase">Painel Admin</span>
            {!ghConfig && <span className="font-mono text-[9px] text-amber-400 border border-amber-500/30 px-2 py-0.5 uppercase">GitHub não configurado</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); onOpenUpload(); }} disabled={!ghConfig} className={`flex items-center gap-1.5 px-3 py-2 font-bold text-[10px] tracking-widest uppercase ${ghConfig ? "bg-primary text-background" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
              <Plus size={11} /> Upload
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border border-border text-muted-foreground"><X size={14} /></button>
          </div>
        </div>

        <div className="flex border-b border-border flex-shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-3 font-mono text-[10px] tracking-widest uppercase transition-colors border-b-2 flex-shrink-0 ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4 md:p-5">

          {/* ── GITHUB TAB ── */}
          {tab === "github" && (
            <GitHubConfigTab
              ghConfig={ghConfig}
              onSave={(cfg) => setGhConfig(cfg)}
              onClear={clearGhConfig}
              onPublish={() => publish(cms)}
              cms={cms}
              saveStatus={saveStatus}
              saveError={saveError}
              uploadMsg={uploadMsg}
            />
          )}

          {/* ── UPLOADS TAB ── */}
          {tab === "uploads" && (
            <div className="space-y-5">
              {/* Seeds */}
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary" /> Arquivos do código ({ALL_SEEDS.length})
                </div>
                {ALL_SEEDS.map((p) => {
                  const hidden = hiddenSeeds.has(p.id);
                  const isPinned = pinned.has(p.id);
                  return (
                    <div key={p.id} className={`flex items-center gap-3 border p-3 ${hidden ? "border-border/30 opacity-50" : "border-border"}`}>
                      <div className="w-16 h-11 flex-shrink-0 bg-background overflow-hidden">
                        <video src={p.mediaUrl} muted className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[9px] text-primary tracking-widest uppercase">{p.category}</div>
                        <div className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{p.title}</div>
                        <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 ${isPinned && !hidden ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{hidden ? "Oculto" : isPinned ? "Em destaque" : "Na galeria"}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {!hidden && <button onClick={() => togglePin(p.id)} className={`font-mono text-[9px] px-2 py-1.5 border flex items-center gap-1 ${isPinned ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{isPinned ? <><Pin size={9} /> Fixado</> : <><PinOff size={9} /> Fixar</>}</button>}
                        {hidden ? <button onClick={() => toggleHideSeed(p.id)} className="font-mono text-[9px] px-2 py-1.5 border border-green-500/40 text-green-400">Exibir</button>
                          : <button onClick={() => toggleHideSeed(p.id)} className="font-mono text-[9px] px-2 py-1.5 border border-red-500/40 text-red-400">Ocultar</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Uploaded */}
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500" /> Uploads no GitHub ({cms.projects.length})
                </div>
                {cms.projects.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-3 border border-dashed border-border">
                    <Upload size={20} className="text-muted-foreground" />
                    <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Nenhum upload ainda</p>
                    {!ghConfig && <p className="font-mono text-[9px] text-amber-400">Configure o GitHub primeiro</p>}
                    {ghConfig && <button onClick={() => { onClose(); onOpenUpload(); }} className="flex items-center gap-2 bg-primary text-background px-4 py-2 font-bold text-xs tracking-widest uppercase"><Plus size={11} /> Primeiro upload</button>}
                  </div>
                ) : (
                  <div className="space-y-px">
                    {cms.projects.map((p) => {
                      const isPinned = pinned.has(p.id);
                      return (
                        <div key={p.id} className="border border-border bg-background">
                          {editingId === p.id ? (
                            <div className="p-4 space-y-3">
                              <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-1">Título</label><input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" /></div>
                              <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-1">Descrição</label><textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none" /></div>
                              <div><div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-1">Categoria</div><div className="grid grid-cols-2 gap-1.5">{CATEGORIES.map((cat) => <button key={cat} onClick={() => setEditCat(cat)} className={`font-mono text-[10px] tracking-widest uppercase px-2 py-2 border text-left ${editCat === cat ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{cat}</button>)}</div></div>
                              <div className="flex gap-3"><button onClick={() => saveEdit(p.id)} disabled={saving} className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs tracking-widest uppercase ${savedId === p.id ? "bg-green-600 text-white" : "bg-primary text-background"}`}>{savedId === p.id ? <><Check size={12} /> Salvo!</> : saving ? "..." : <><Check size={12} /> Salvar</>}</button><button onClick={() => setEditingId(null)} className="font-mono text-xs text-muted-foreground">Cancelar</button></div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-3">
                              <div className="w-16 h-11 flex-shrink-0 bg-card overflow-hidden relative">
                                {p.mediaType === "video" ? <video src={p.mediaUrl} muted className="w-full h-full object-cover" /> : <img src={p.thumbUrl ?? p.mediaUrl} alt={p.title} className="w-full h-full object-cover" />}
                                <div className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-background/70">{p.mediaType === "video" ? <VideoIcon size={9} className="text-primary" /> : <ImageIcon size={9} />}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-[9px] text-primary tracking-widest uppercase">{p.category}</div>
                                <div className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{p.title}</div>
                                <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 ${isPinned ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{isPinned ? "Em destaque" : "Na galeria"}</span>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <button onClick={() => togglePin(p.id)} className={`font-mono text-[9px] px-2 py-1.5 border flex items-center gap-1 ${isPinned ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{isPinned ? <><Pin size={9} /> Fixado</> : <><PinOff size={9} /> Fixar</>}</button>
                                <button onClick={() => { setEditingId(p.id); setEditTitle(p.title); setEditDesc(p.description); setEditCat(p.category); }} className="font-mono text-[9px] px-2 py-1.5 border border-border text-muted-foreground">✏ Editar</button>
                                <button onClick={() => deleteUpload(p.id)} className="font-mono text-[9px] px-2 py-1.5 border border-red-500/40 text-red-400 hover:bg-red-500/10"><Trash2 size={9} className="mx-auto" /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TEXTOS TAB ── */}
          {tab === "textos" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><p className="font-mono text-[10px] text-muted-foreground tracking-wider">Edite. Clique em Publicar (aba GitHub) para salvar.</p></div>
              {contentFields.map(({ key, label, multi }) => (
                <div key={key}>
                  <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-1">{label}</label>
                  {multi ? <textarea value={cms.content[key]} onChange={(e) => updateContent(key, e.target.value)} rows={3} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none" />
                    : <input value={cms.content[key]} onChange={(e) => updateContent(key, e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />}
                </div>
              ))}
            </div>
          )}

          {/* ── CORES TAB ── */}
          {tab === "cores" && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] text-muted-foreground tracking-wider">Aplica imediatamente. Publique para persistir.</p>
              {themeFields.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 border border-border p-3">
                  <input type="color" value={cms.theme[key].startsWith("rgba") ? "#1a1e2b" : cms.theme[key]} onChange={(e) => updateTheme(key, e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-1">{label}</div>
                    <input value={cms.theme[key]} onChange={(e) => updateTheme(key, e.target.value)} className="w-full bg-muted border border-border px-2 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-primary transition-colors" />
                  </div>
                  <div className="w-8 h-8 border border-border flex-shrink-0" style={{ background: cms.theme[key] }} />
                </div>
              ))}
            </div>
          )}

          {/* ── INFO TAB ── */}
          {tab === "info" && (
            <div className="space-y-4">
              <div className="border border-green-500/20 bg-green-500/5 p-4">
                <div className="font-mono text-[10px] text-green-400 tracking-widest uppercase mb-2">Arquitetura CMS Real</div>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">Todo conteúdo é persistido no <strong className="text-foreground">repositório GitHub</strong> em <code className="text-primary font-mono text-xs">public/cms-data.json</code>. Arquivos de mídia vão para <code className="text-primary font-mono text-xs">public/uploads/</code>. A Netlify detecta cada commit e republica automaticamente.</p>
              </div>
              <div className="border border-border p-4 space-y-2">
                <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-2">Fluxo de trabalho</div>
                {[
                  "1. Faça login como admin",
                  "2. Configure GitHub (aba GitHub) — só precisa fazer uma vez por sessão",
                  "3. Edite textos, cores ou faça uploads",
                  "4. Clique em 'Publicar agora' na aba GitHub",
                  "5. Aguarde ~2 minutos para o Netlify republicar",
                  "6. Todos os dispositivos verão o conteúdo atualizado",
                ].map((s, i) => <p key={i} className="text-sm text-muted-foreground font-light">{s}</p>)}
              </div>
              <div className="border border-border p-4">
                <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-2">Credenciais Admin</div>
                <div className="font-mono text-sm space-y-1"><div>Usuário: <span className="text-primary">{ADMIN_USER}</span></div><div>Senha: <span className="text-primary">{ADMIN_PASS}</span></div></div>
              </div>
              <div className="border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="font-mono text-[10px] text-amber-400 tracking-widest uppercase mb-2">Limite de tamanho</div>
                <p className="text-sm text-amber-200/70 font-light">A GitHub API suporta arquivos até <strong className="text-amber-200">25MB</strong> via upload. Para vídeos maiores, hospede no YouTube/Vimeo e adicione como link externo.</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">{(ALL_SEEDS.length + cms.projects.length)} proj · {pinned.size} destaque</span>
          <button onClick={onClose} className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ─── App ────────────────────────────────────────────────────────── */

export default function App() {
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

  const {
    ghConfig, setGhConfig, clearGhConfig,
    cms, setCms, loading,
    saveStatus, saveError, uploadMsg,
    publish, uploadFile, deleteFile,
  } = useCMS();

  // Derived state
  const content = cms.content;
  const pinned = new Set(cms.pinned);
  const hiddenSeeds = new Set(cms.hiddenSeeds);
  const visibleSeeds = ALL_SEEDS.filter(s => !hiddenSeeds.has(s.id));
  const allProjects: DisplayProject[] = [...visibleSeeds, ...cms.projects];
  const featuredProjects = allProjects.filter(p => pinned.has(p.id));

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const scrollTo = (href: string) => { setMenuOpen(false); document.querySelector(href)?.scrollIntoView({ behavior: "smooth" }); };
  const logout = () => { sessionStorage.removeItem(SESSION_KEY); setAdminMode(false); setAdminOpen(false); };

  const openProjectGallery = (item: DisplayProject) => {
    const svc = SERVICES.find(s => s.galleryCategories.includes(item.category));
    if (svc) { setGalleryService(svc); setGalleryInitialItem(item); }
  };

  const handleAddProject = async (proj: CMSProject) => {
    const updated: CMSData = { ...cms, projects: [proj, ...cms.projects], pinned: [...cms.pinned, proj.id] };
    await publish(updated);
  };

  const handleDeleteProject = async (id: string) => {
    const proj = cms.projects.find(p => p.id === id);
    if (proj) {
      if (proj.mediaUrl.startsWith("/uploads/")) await deleteFile(proj.mediaUrl);
      if (proj.thumbUrl?.startsWith("/uploads/")) await deleteFile(proj.thumbUrl);
    }
    const updated: CMSData = { ...cms, projects: cms.projects.filter(p => p.id !== id), pinned: cms.pinned.filter(p => p !== id) };
    await publish(updated);
  };

  const handleTogglePin = (id: string) => {
    const next = pinned.has(id) ? cms.pinned.filter(p => p !== id) : [...cms.pinned, id];
    setCms({ ...cms, pinned: next });
  };

  const handleAudioUpload = async (file: File) => {
    const url = await uploadFile(file, "audio");
    if (!url) return;
    const updated: CMSData = { ...cms, audio: { name: file.name, url } };
    await publish(updated);
  };

  const handleAudioDelete = async () => {
    if (cms.audio?.url.startsWith("/uploads/")) await deleteFile(cms.audio.url);
    const updated: CMSData = { ...cms, audio: null };
    await publish(updated);
  };

  const navLinks = [
    { label: "Serviços", href: "#servicos" },
    { label: "Trabalhos", href: "#trabalhos" },
    { label: "Por que eu?", href: "#diferenciais" },
    { label: "Contato", href: "#contato" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={28} className="text-primary animate-spin" />
          <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Carregando portfólio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={{ fontFamily: "'Barlow', sans-serif" }}>

      {/* Modals */}
      <AdminLoginModal open={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => setAdminMode(true)} />
      <GalleryModal
        service={galleryService} allProjects={allProjects} initialItem={galleryInitialItem}
        onClose={() => { setGalleryService(null); setGalleryInitialItem(null); }}
        showAdmin={adminMode} onDelete={handleDeleteProject} onTogglePin={handleTogglePin} pinned={pinned}
      />
      <UploadModal
        open={uploadOpen} onClose={() => setUploadOpen(false)}
        onSave={handleAddProject} uploadFile={uploadFile} ghConfigured={!!ghConfig}
      />
      <AdminPanel
        open={adminOpen} onClose={() => setAdminOpen(false)}
        cms={cms} setCms={setCms}
        publish={publish} uploadFile={uploadFile} deleteFile={deleteFile}
        ghConfig={ghConfig} setGhConfig={setGhConfig} clearGhConfig={clearGhConfig}
        saveStatus={saveStatus} saveError={saveError} uploadMsg={uploadMsg}
        onOpenUpload={() => { setAdminOpen(false); setUploadOpen(true); }}
      />

      {/* Progress bar */}
      <div className="fixed top-0 left-0 h-[2px] bg-primary z-[100] transition-[width] duration-75" style={{ width: `${progress * 100}%` }} />

      {/* Admin FAB */}
      {adminMode && (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-2">
          {saveStatus === "saving" && (
            <div className="flex items-center gap-2 bg-card border border-primary/30 px-3 py-2 text-[10px] font-mono text-primary">
              <Loader2 size={10} className="animate-spin" /> Publicando...
            </div>
          )}
          {saveStatus === "success" && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-3 py-2 text-[10px] font-mono text-green-400">
              <CheckCircle2 size={10} /> Publicado!
            </div>
          )}
          <button onClick={logout} className="flex items-center gap-1.5 bg-card border border-border text-muted-foreground px-3 py-2 text-[10px] font-mono tracking-widest uppercase shadow-lg"><LogOut size={11} /> Sair</button>
          <button onClick={() => setAdminOpen(true)} className="flex items-center gap-1.5 bg-primary text-background px-4 py-2.5 font-bold text-[10px] tracking-widest uppercase shadow-lg"><Settings size={12} /> Painel Admin</button>
          <button onClick={() => setUploadOpen(true)} disabled={!ghConfig} className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center shadow-xl transition-colors ${ghConfig ? "bg-primary text-background hover:bg-primary/85" : "bg-muted text-muted-foreground cursor-not-allowed"}`} title={ghConfig ? "Novo upload" : "Configure o GitHub primeiro"}>
            <Plus size={20} />
          </button>
        </div>
      )}

      {/* ── NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/96 backdrop-blur border-b border-border" : ""}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3.5 md:py-4 flex items-center justify-between">
          <button onClick={() => scrollTo("#hero")}>
            <img src={logoImg} alt="Freed Pierre" className="h-10 md:h-12 w-auto object-contain brightness-200" />
          </button>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => <button key={l.href} onClick={() => scrollTo(l.href)} className="font-medium text-xs tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors">{l.label}</button>)}
            {!adminMode
              ? <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 font-bold text-xs tracking-widest uppercase hover:bg-primary/85 transition-colors"><MessageCircle size={13} /> Orçamento</a>
              : <button onClick={() => setAdminOpen(true)} className="font-mono text-[10px] text-primary tracking-widest uppercase border border-primary/30 px-3 py-1.5 hover:bg-primary/10 transition-colors flex items-center gap-1.5"><Settings size={12} /> Admin</button>}
          </div>
          <button className="md:hidden text-foreground p-1" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        <div className={`md:hidden overflow-hidden transition-[max-height] duration-300 ${menuOpen ? "max-h-80" : "max-h-0"} bg-card border-b border-border`}>
          <div className="px-5 py-5 flex flex-col gap-5">
            {navLinks.map((l) => <button key={l.href} onClick={() => scrollTo(l.href)} className="text-left font-medium text-xs tracking-[0.2em] uppercase text-muted-foreground">{l.label}</button>)}
            <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-primary text-background px-5 py-3 font-bold text-xs tracking-widest uppercase w-fit"><MessageCircle size={13} /> Orçamento</a>
            {adminMode && <button onClick={() => { setMenuOpen(false); setAdminOpen(true); }} className="flex items-center gap-2 text-primary font-mono text-[10px] tracking-widest uppercase"><Settings size={12} /> Painel Admin</button>}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-background">
          <video src={heroVideo} autoPlay muted loop playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-background/65" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/20 to-background" />
        </div>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "200px" }} />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-5 md:px-8 text-center pt-20 md:pt-0">
          <div className="inline-flex items-center gap-2 border border-primary/40 px-4 py-1.5 mb-8 md:mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[10px] text-primary tracking-[0.25em] uppercase">{content.heroBadge}</span>
          </div>
          <h1 className="font-black uppercase leading-[0.85] mb-6 md:mb-8" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(2.8rem, 13vw, 10.5rem)" }}>
            <span className="block text-foreground">{content.heroLine1}</span>
            <span className="block text-primary">{content.heroLine2}</span>
            <span className="block text-foreground">{content.heroLine3}</span>
            <span className="block" style={{ WebkitTextStroke: "clamp(1px, 0.2vw, 2px) rgba(237,233,226,0.55)", color: "transparent" }}>{content.heroLine4}</span>
          </h1>
          <p className="text-muted-foreground font-light text-sm md:text-lg max-w-md md:max-w-xl mx-auto mb-8 md:mb-10 leading-relaxed">{content.heroSubtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center px-4 sm:px-0">
            <button onClick={() => scrollTo("#servicos")} className="flex items-center justify-center gap-2 bg-primary text-background px-8 py-3.5 font-bold text-sm tracking-widest uppercase hover:bg-primary/85 transition-colors">Ver serviços</button>
            <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 border border-foreground/20 text-foreground px-8 py-3.5 font-semibold text-sm tracking-widest uppercase hover:border-foreground/50 transition-colors"><MessageCircle size={15} /> WhatsApp</a>
          </div>
        </div>

        <div className="relative z-10 w-full border-t border-border mt-12 md:mt-16">
          <div className="max-w-6xl mx-auto px-5 md:px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {["Design Gráfico", "Motion Design", "Videos", "Produção Fonográfica"].map((d, i) => (
              <div key={d} className={`flex items-center gap-2 ${i > 0 ? "md:border-l md:border-border md:pl-8" : ""}`}>
                <span className="w-1 h-1 bg-primary flex-shrink-0" />
                <span className="font-mono text-[10px] text-muted-foreground tracking-[0.15em] uppercase font-bold leading-tight">{d}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => scrollTo("#servicos")} className="absolute bottom-5 left-1/2 -translate-x-1/2 text-muted-foreground"><ChevronDown size={16} className="animate-bounce" /></button>
      </section>

      {/* ── SERVIÇOS ── */}
      <section id="servicos" className="py-16 md:py-28">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <FadeIn><SectionLabel>Serviços</SectionLabel></FadeIn>
          <FadeIn delay={60}><h2 className="text-4xl md:text-7xl font-black uppercase text-foreground leading-none mb-10 md:mb-16" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>O que posso<br /><span className="text-primary">fazer por você?</span></h2></FadeIn>

          {/* Desktop */}
          <div className="hidden md:grid grid-cols-[220px_1fr] gap-0 border border-border">
            <div className="border-r border-border">
              {SERVICES.map((s, i) => (
                <button key={s.number} onClick={() => setActiveService(i)} className={`w-full text-left px-6 py-5 border-b border-border last:border-b-0 transition-all ${activeService === i ? "bg-primary/8" : "hover:bg-muted/40"}`}>
                  <div className={`font-mono text-[10px] tracking-widest uppercase mb-1.5 ${activeService === i ? "text-primary" : "text-muted-foreground"}`}>{s.number}</div>
                  <div className={`text-lg font-black uppercase leading-tight ${activeService === i ? "text-primary" : "text-foreground"}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.title}</div>
                  {activeService === i && <div className="mt-2 h-px w-6 bg-primary" />}
                </button>
              ))}
            </div>
            <div className="p-10">
              <div className="text-primary mb-5">{SERVICES[activeService].icon}</div>
              <h3 className="text-4xl font-black uppercase text-foreground mb-4 leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{SERVICES[activeService].title}</h3>
              <p className="text-muted-foreground text-base leading-relaxed font-light mb-8">{SERVICES[activeService].description}</p>
              <div className="flex flex-wrap gap-2 mb-8">{SERVICES[activeService].tags.map((t) => <span key={t} className="font-mono text-[10px] tracking-widest uppercase border border-border text-muted-foreground px-3 py-1.5 hover:border-primary hover:text-primary transition-colors">{t}</span>)}</div>
              <div className="flex flex-wrap items-center gap-6">
                <button onClick={() => { setGalleryService(SERVICES[activeService]); setGalleryInitialItem(null); }} className="inline-flex items-center gap-2 bg-primary text-background px-6 py-2.5 font-bold text-xs tracking-widest uppercase hover:bg-primary/85 transition-colors">Ver galeria <Film size={13} /></button>
                <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary font-semibold text-sm tracking-wider uppercase hover:gap-3 transition-all">Solicitar orçamento <ArrowUpRight size={15} /></a>
              </div>
            </div>
          </div>

          {/* Mobile accordion */}
          <div className="md:hidden space-y-2">
            {SERVICES.map((s, i) => {
              const open = activeService === i;
              return (
                <FadeIn key={s.number} delay={i * 50}>
                  <div className="border border-border overflow-hidden">
                    <button onClick={() => setActiveService(open ? -1 : i)} className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${open ? "bg-primary/8" : ""}`}>
                      <span className={`flex-shrink-0 ${open ? "text-primary" : "text-muted-foreground"}`}>{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-0.5">{s.number}</div>
                        <div className={`text-xl font-black uppercase leading-tight ${open ? "text-primary" : "text-foreground"}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.title}</div>
                      </div>
                      <ChevronDown size={16} className={`text-muted-foreground flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                    </button>
                    <div className={`overflow-hidden transition-[max-height] duration-300 ${open ? "max-h-96" : "max-h-0"}`}>
                      <div className="px-5 pb-5 pt-1 border-t border-border">
                        <p className="text-muted-foreground text-sm leading-relaxed font-light mb-4">{s.description}</p>
                        <div className="flex flex-wrap gap-1.5 mb-5">{s.tags.map((t) => <span key={t} className="font-mono text-[10px] tracking-widest uppercase border border-border text-muted-foreground px-2.5 py-1">{t}</span>)}</div>
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
      <section id="trabalhos" className="py-16 md:py-28 bg-card/30">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <FadeIn><SectionLabel>Mostrando Meu Trabalho</SectionLabel></FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-10 md:mb-14">
            <FadeIn delay={60}><h2 className="text-4xl md:text-7xl font-black uppercase text-foreground leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Projetos<br /><span className="text-primary">em destaque</span></h2></FadeIn>
            {adminMode && <FadeIn delay={120}><button onClick={() => setUploadOpen(true)} disabled={!ghConfig} className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs tracking-widest uppercase self-start sm:self-auto ${ghConfig ? "bg-primary text-background" : "bg-muted text-muted-foreground cursor-not-allowed"}`}><Plus size={13} /> Adicionar</button></FadeIn>}
          </div>
          {featuredProjects.length === 0
            ? <div className="border border-dashed border-border py-16 text-center px-5">
                <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase mb-2">Nenhum projeto em destaque</p>
                {adminMode && <p className="font-mono text-[10px] text-muted-foreground/60 tracking-wider">Use o botão Pin para escolher quais projetos aparecem aqui.</p>}
              </div>
            : <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
                {featuredProjects.map((item, i) => (
                  <FadeIn key={item.id} delay={i * 50}>
                    <ProjectCard item={item} showAdmin={adminMode} isPinned={pinned.has(item.id)} onTogglePin={handleTogglePin} onDelete={!item.isFixed ? handleDeleteProject : undefined} onClick={() => openProjectGallery(item)} />
                  </FadeIn>
                ))}
              </div>}
        </div>
      </section>

      {/* ── DIFERENCIAIS ── */}
      <section id="diferenciais" className="py-16 md:py-28">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <FadeIn><SectionLabel>Por que eu?</SectionLabel></FadeIn>
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
            <FadeIn delay={60}>
              <div>
                <h2 className="text-4xl md:text-6xl font-black uppercase text-foreground leading-none mb-5 md:mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {content.difHeading1}<br />{content.difHeading2}<br /><span className="text-primary">{content.difHeading3}</span>
                </h2>
                <p className="text-muted-foreground font-light text-sm md:text-base leading-relaxed mb-6 md:mb-8">{content.difSubtext}</p>
                <AudioPlayer audio={cms.audio} adminMode={adminMode} onUpload={handleAudioUpload} onDelete={handleAudioDelete} ghConfigured={!!ghConfig} />
              </div>
            </FadeIn>
            <div className="space-y-0">
              {ADVANTAGES.map((adv, i) => (
                <FadeIn key={adv.num} delay={80 + i * 60}>
                  <div className="border-b border-border py-5 md:py-7">
                    <div className="flex items-start gap-4 md:gap-5">
                      <span className="font-mono text-[10px] text-primary tracking-widest mt-1 flex-shrink-0">{adv.num}</span>
                      <div><h3 className="text-lg md:text-xl font-black uppercase text-foreground mb-1.5 leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{adv.title}</h3><p className="text-sm text-muted-foreground font-light leading-relaxed">{adv.body}</p></div>
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
            {[
              { n: content.stat1Val, l: content.stat1Label },
              { n: content.stat2Val, l: content.stat2Label },
              { n: content.stat3Val, l: content.stat3Label },
              { n: content.stat4Val, l: content.stat4Label },
            ].map((s) => (
              <div key={s.l} className="bg-card/40 px-5 md:px-8 py-6 md:py-7 text-center">
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
                <h2 className="text-4xl md:text-7xl font-black uppercase text-foreground leading-none mb-5 md:mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {content.contactHeading.split(" ").slice(0, 1).join(" ")}<br />
                  <span className="text-primary">{content.contactHeading.split(" ").slice(1, 2).join(" ")}</span><br />
                  {content.contactHeading.split(" ").slice(2).join(" ")}
                </h2>
                <p className="text-muted-foreground font-light text-sm md:text-base leading-relaxed mb-7 md:mb-8">{content.contactSubtext}</p>
                <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-primary text-background px-7 md:px-8 py-4 font-black tracking-widest uppercase hover:bg-primary/85 transition-colors w-full sm:w-auto justify-center" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem" }}>
                  <MessageCircle size={17} /> Falar no WhatsApp
                </a>
              </div>
            </FadeIn>
            <FadeIn delay={140}>
              <div className="border border-border divide-y divide-border">
                {CONTACT_LINKS.map((c) => (
                  <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined} className="flex items-center gap-4 md:gap-5 px-5 md:px-7 py-5 md:py-6 hover:bg-muted/40 transition-colors group">
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
            <button onClick={() => scrollTo("#hero")}><img src={logoImg} alt="Freed Pierre" className="h-9 w-auto object-contain brightness-200 opacity-80" /></button>
            <p className="font-mono text-[10px] text-muted-foreground tracking-wider leading-relaxed" onClick={() => !adminMode && setShowLogin(true)}>
              {content.footerCopy}
              {adminMode && <span className="block text-primary mt-0.5">ADMIN ATIVO</span>}
            </p>
            <div className="flex items-center gap-5">
              <a href="https://wa.me/5531975791151" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors"><MessageCircle size={18} /></a>
              <a href="mailto:fredericopierredamasceno@gmail.com" className="text-muted-foreground hover:text-primary transition-colors"><Mail size={18} /></a>
            </div>
          </div>
          <div className="hidden md:grid grid-cols-3 items-center gap-4">
            <div className="flex justify-start">
              <button onClick={() => scrollTo("#hero")}><img src={logoImg} alt="Freed Pierre" className="h-10 w-auto object-contain brightness-200 opacity-80 hover:opacity-100 transition-opacity" /></button>
            </div>
            <div className="flex justify-center">
              <p className="font-mono text-[10px] text-muted-foreground tracking-widest text-center leading-relaxed cursor-default" onClick={() => !adminMode && setShowLogin(true)}>
                {content.footerCopy}
                {adminMode && <span className="block text-primary mt-0.5">ADMIN ATIVO</span>}
              </p>
            </div>
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
