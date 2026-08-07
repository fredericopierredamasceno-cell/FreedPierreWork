import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  Mail, Menu, X, ChevronDown, Mic, Film, Palette,
  MessageCircle, ArrowUpRight, Play, Upload, Trash2, Plus,
  Sparkles, Settings, LogOut, Loader2, CheckCircle2,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import heroVideo from "../imports/Portf_lio_Video_Final_Ver.mp4";
import logoImg from "../imports/Logo_Freed_Pierre.png";

import type { CMSData, CMSProject, CMSAudio, DisplayProject } from "./lib/types";
import { ALL_SEEDS, SERVICE_ICONS, SERVICE_CATEGORIES, SERVICE_NUMBERS, CATEGORIES, CONTACT_LINKS } from "./lib/defaults";
import { checkSession, endSession, renewSession } from "./lib/session";

import { useCMS } from "./hooks/useCMS";
import { useScrollProgress } from "./hooks/useScrollProgress";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { FadeIn } from "./components/FadeIn";
import { SectionLabel } from "./components/SectionLabel";
import { LoadingScreen } from "./components/LoadingScreen";
import { PublishProgressModal } from "./components/PublishProgressModal";
import { AdminLoginModal } from "./components/AdminLoginModal";
import { ProjectCard } from "./components/ProjectCard";
import { CarouselRow } from "./components/CarouselRow";
import { AudioCarousel } from "./components/AudioCarousel";
import { UploadModal } from "./components/UploadModal";
import { GalleryModal } from "./components/GalleryModal";
import { AdminPanel } from "./components/AdminPanel";
export function PortfolioApp() {
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
  // bloqueado e o vídeo fica parado no primeiro frame ("congelado").
  //
  // Correção reforçada (multi-camada, cobre os cenários mais comuns de
  // bloqueio de autoplay mobile observados em produção):
  // 1) `.muted` forçado como propriedade JS (não só atributo) ANTES de
  //    qualquer chamada a `.play()` — alguns engines mobile só permitem
  //    autoplay mudo se a propriedade já estiver true no momento da chamada.
  // 2) Tentativas de play() em múltiplos eventos do próprio vídeo
  //    (loadedmetadata, loadeddata, canplay, canplaythrough) — cobre casos
  //    em que o navegador libera o autoplay só depois de decodificar o
  //    primeiro frame, o que varia por dispositivo/conexão.
  // 3) Retentativas curtas por alguns segundos após o mount (cobre o caso
  //    de o primeiro play() ser rejeitado por timing, antes do elemento
  //    estar 100% pronto).
  // 4) Retomada ao voltar de background/aba (visibilitychange/pageshow) —
  //    iOS/Android pausam vídeos ao minimizar o app.
  // 5) Fallback definitivo: no primeiro toque/scroll/clique do usuário em
  //    qualquer lugar da página, se o vídeo ainda estiver pausado, tenta
  //    play() de novo — como é um gesto real do usuário, isso SEMPRE tem
  //    permissão de autoplay em qualquer navegador, então garante que o
  //    vídeo nunca fique travado indefinidamente.
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (loading) return;
    const v = heroVideoRef.current;
    if (!v) return;

    let cancelled = false;
    const tryPlay = () => {
      if (cancelled || !v.paused) return;
      v.muted = true;
      v.defaultMuted = true;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    tryPlay();

    // Retentativas curtas logo após o mount (cobre timing de decodificação
    // do primeiro frame em conexões mobile mais lentas).
    const retryTimeouts = [100, 400, 900, 1800, 3000].map(ms => setTimeout(tryPlay, ms));

    const events: (keyof HTMLVideoElementEventMap)[] = ["loadedmetadata", "loadeddata", "canplay", "canplaythrough"];
    events.forEach(ev => v.addEventListener(ev, tryPlay));

    document.addEventListener("visibilitychange", tryPlay);
    window.addEventListener("pageshow", tryPlay);

    // Fallback garantido: qualquer gesto real do usuário destrava autoplay
    // em 100% dos navegadores mobile, mesmo que as tentativas silenciosas
    // acima tenham sido bloqueadas pela política do dispositivo/navegador.
    const gestureEvents: (keyof DocumentEventMap)[] = ["touchstart", "click", "scroll"];
    const onGesture = () => { tryPlay(); gestureEvents.forEach(ev => document.removeEventListener(ev, onGesture)); };
    gestureEvents.forEach(ev => document.addEventListener(ev, onGesture, { passive: true, once: true }));

    return () => {
      cancelled = true;
      retryTimeouts.forEach(clearTimeout);
      events.forEach(ev => v.removeEventListener(ev, tryPlay));
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("pageshow", tryPlay);
      gestureEvents.forEach(ev => document.removeEventListener(ev, onGesture));
    };
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
          {/* Mobile: vídeo alinhado 60% à esquerda (sujeito mais centralizado/à esquerda no quadro);
             overlay em gradiente horizontal — bem escuro atrás do texto (esquerda) e mais claro à
             direita, para o vídeo aparecer ao lado da headline em vez de "por baixo" dela.
             Desktop: mantém a composição clássica original (30%, overlay uniforme). */}
          <style>{`
            #hero-video { object-position: 60% top; }
            #hero-overlay { background: linear-gradient(100deg, rgba(7,8,15,0.97) 0%, rgba(7,8,15,0.94) 52%, rgba(7,8,15,0.55) 76%, rgba(7,8,15,0.28) 100%); }
            @media (min-width: 768px) {
              #hero-video { object-position: 30% top; }
              #hero-overlay { background: rgba(7,8,15,0.65); }
            }
          `}</style>
          <video
            ref={heroVideoRef}
            id="hero-video"
            src={heroVideo} autoPlay muted loop playsInline
            preload="auto"
            disablePictureInPicture
            onLoadedMetadata={e => { e.currentTarget.muted = true; e.currentTarget.play().catch(() => {}); }}
            onCanPlay={e => { if (e.currentTarget.paused) e.currentTarget.play().catch(() => {}); }}
            className="w-full h-full object-cover"
            style={{ transform: "translateZ(0)", WebkitBackfaceVisibility: "hidden", backfaceVisibility: "hidden" }}
          />
          <div id="hero-overlay" className="absolute inset-0" />
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
