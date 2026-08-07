import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  Settings, Plus, X, Pin, Trash2, Upload, Youtube, Music, Star,
  Github, Library, FolderOpen, FileText, Sparkles, Paintbrush, Info, ScrollText, Disc,
} from "lucide-react";
import type {
  GitHubConfig, CMSData, CMSAudio, CMSProject, CMSRelease, UploadProgress, LogEntry, SaveStatus,
  CMSServiceContent, CMSAdvantageContent, AdminTab,
} from "../lib/types";
import type { SiteContent, SiteTheme } from "../lib/defaults";
import { ALL_SEEDS, SERVICE_NUMBERS } from "../lib/defaults";
import { releaseLinks } from "../lib/platformIcons";
import { GitHubConfigTab } from "./GitHubConfigTab";
import { MediaLibraryTab } from "./MediaLibraryTab";
import { EditAudioModal } from "./EditAudioModal";
import { EditProjectModal } from "./EditProjectModal";
import { VisibilityToggleButton, VisibilityBadge } from "./edit/VisibilityToggleButton";
import { LogsTab } from "./LogsTab";
export function AdminPanel({ open, onClose, cms, setCms, publish, uploadFile, deleteFile, syncFromGitHub, ghConfig, setGhConfig, clearGhConfig, saveStatus, saveError, logs, onOpenUpload, onOpenReleaseForm, onDeleteRelease, onToggleHideRelease }: {
  open: boolean; onClose: () => void; cms: CMSData; setCms: (d: CMSData) => void;
  publish: (d: CMSData) => Promise<boolean>;
  uploadFile: (f: File, t: "image" | "video" | "audio", onProgress: (p: UploadProgress) => void) => Promise<string | null>;
  deleteFile: (path: string) => Promise<void>;
  syncFromGitHub: () => Promise<boolean>;
  ghConfig: GitHubConfig | null; setGhConfig: (c: GitHubConfig) => void; clearGhConfig: () => void;
  saveStatus: SaveStatus; saveError: string; logs: LogEntry[]; onOpenUpload: () => void;
  onOpenReleaseForm: (release?: CMSRelease) => void;
  onDeleteRelease: (id: string) => Promise<void>;
  onToggleHideRelease: (id: string) => void;
}) {
  const [tab, setTab] = useState<AdminTab>("github");
  const [editingAudio, setEditingAudio] = useState<CMSAudio | null>(null);
  const [editingProject, setEditingProject] = useState<CMSProject | null>(null);

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
  const ghOk = !!ghConfig;

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

  // Apenas uma música pode estar fixada como destaque por vez — marcar outra
  // remove automaticamente a marcação anterior.
  const toggleFeaturedAudio = (id: string) => {
    setCms({ ...cms, audios: cms.audios.map(a => ({ ...a, isFeatured: a.id === id ? !a.isFeatured : false })) });
  };

  const saveAudio = async (updated: CMSAudio) => {
    setCms({ ...cms, audios: cms.audios.map(a => a.id === updated.id ? updated : a) });
    setEditingAudio(null);
  };

  const saveProject = async (updated: CMSProject) => {
    setCms({ ...cms, projects: cms.projects.map(p => p.id === updated.id ? updated : p) });
    setEditingProject(null);
  };

  // Ocultar não apaga — some do site, continua salvo no CMS e pode ser
  // reativado a qualquer momento. Vale para vídeo, imagem, motion, design
  // gráfico e qualquer categoria futura (mesmo padrão usado nos áudios).
  const toggleHideProject = (id: string) => {
    const proj = cms.projects.find(p => p.id === id);
    if (!proj) return;
    const nowHidden = !proj.hidden;
    setCms({
      ...cms,
      projects: cms.projects.map(p => p.id === id ? { ...p, hidden: nowHidden } : p),
      pinned: nowHidden ? cms.pinned.filter(pid => pid !== id) : cms.pinned,
    });
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

          {tab === "midias" && (
            <MediaLibraryTab
              cms={cms}
              onDeleteProject={delUpload}
              onDeleteAudio={delAudio}
              onEditProject={setEditingProject}
              onEditAudio={setEditingAudio}
              onToggleHideProject={toggleHideProject}
              onToggleHideAudio={toggleHideAudio}
            />
          )}

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
                        <div key={p.id} className={`border mb-1 ${p.hidden ? "border-border/40 opacity-50" : "border-border"}`}>
                          <div className="flex items-center gap-2 p-2">
                            <div className="w-12 h-9 flex-shrink-0 bg-card overflow-hidden relative">
                              {isEmbed && p.thumbUrl && <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />}
                              {isEmbed && !p.thumbUrl && <div className="w-full h-full flex items-center justify-center"><Youtube size={12} className="text-red-400" /></div>}
                              {!isEmbed && p.mediaType === "video" && <video src={p.mediaUrl} muted className="w-full h-full object-cover" />}
                              {!isEmbed && p.mediaType === "image" && <img src={(p.images?.[0] ?? p.thumbUrl ?? p.mediaUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{p.title}</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-mono text-[9px] uppercase ${isPin ? "text-primary" : "text-muted-foreground"}`}>{isPin ? "● Destaque" : "○ Galeria"}</span>
                                {p.images && p.images.length > 1 && <span className="font-mono text-[9px] text-muted-foreground">×{p.images.length} imagens</span>}
                                <VisibilityBadge hidden={!!p.hidden} />
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {!p.hidden && <button onClick={() => togglePin(p.id)} className={`font-mono text-[9px] px-2 py-1 border ${isPin ? "border-primary text-primary" : "border-border text-muted-foreground"}`}><Pin size={8} /></button>}
                              <button onClick={() => setEditingProject(p)} title="Editar" className="font-mono text-[9px] px-2 py-1 border border-border text-muted-foreground hover:border-primary hover:text-primary">✏</button>
                              <VisibilityToggleButton hidden={!!p.hidden} onToggle={() => toggleHideProject(p.id)} />
                              <button onClick={() => delUpload(p.id)} title="Deletar permanentemente" className="font-mono text-[9px] px-2 py-1 border border-red-500/40 text-red-400"><Trash2 size={8} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
              </div>

              {/* EditProjectModal — edição completa (vídeo, imagem/carrossel, embed) */}
              <EditProjectModal project={editingProject} open={!!editingProject} onClose={() => setEditingProject(null)} onSave={saveProject} onToggleHidden={toggleHideProject} uploadFile={uploadFile} ghConfigured={!!ghConfig} />

              {/* Audio */}
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-green-400" />Produções Fonográficas ({cms.audios.length})</div>
                {cms.audios.length === 0
                  ? <p className="font-mono text-[10px] text-muted-foreground tracking-widest">Nenhuma — upload via botão acima (aba Áudio)</p>
                  : cms.audios.map(a => (
                    <div key={a.id} className={`border mb-1 ${a.hidden ? "border-border/40 opacity-50" : a.isFeatured ? "border-primary/50" : "border-border"}`}>
                      <div className="flex items-center gap-2 p-2">
                        <div className="w-10 h-10 flex-shrink-0 overflow-hidden border border-border">
                          {a.coverUrl ? <img src={a.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Music size={12} className="text-muted-foreground" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{a.title}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {a.artist && <p className="font-mono text-[9px] text-muted-foreground">{a.artist}</p>}
                            {a.genre && <span className="font-mono text-[8px] px-1 bg-primary/10 text-primary">{a.genre}</span>}
                            {a.isFeatured && <span className="font-mono text-[8px] px-1 bg-primary/20 text-primary uppercase">★ Destaque</span>}
                            <VisibilityBadge hidden={!!a.hidden} />
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => toggleFeaturedAudio(a.id)} title={a.isFeatured ? "Remover destaque" : "Fixar como destaque"} className={`font-mono text-[9px] px-2 py-1 border ${a.isFeatured ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}><Star size={8} className={a.isFeatured ? "fill-current" : ""} /></button>
                          <button onClick={() => setEditingAudio(a)} title="Editar" className="font-mono text-[9px] px-2 py-1 border border-border text-muted-foreground hover:border-primary hover:text-primary">✏</button>
                          <VisibilityToggleButton hidden={!!a.hidden} onToggle={() => toggleHideAudio(a.id)} />
                          <button onClick={() => delAudio(a.id)} title="Deletar permanentemente" className="font-mono text-[9px] px-2 py-1 border border-red-500/40 text-red-400"><Trash2 size={8} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* EditAudioModal */}
              <EditAudioModal audio={editingAudio} open={!!editingAudio} onClose={() => setEditingAudio(null)} onSave={saveAudio} uploadFile={uploadFile} ghConfigured={!!ghConfig} />

              {/* Lançamentos — "Ouça nas plataformas" (independente do player de prévias acima) */}
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-blue-400" />Lançamentos ({cms.releases.length})</div>
                {cms.releases.length === 0
                  ? <div className="border border-dashed border-border py-8 flex flex-col items-center gap-3"><Disc size={18} className="text-muted-foreground" /><p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Nenhum — divulgue um lançamento oficial</p><button onClick={() => onOpenReleaseForm()} className="flex items-center gap-2 bg-primary text-background px-4 py-2 font-bold text-xs tracking-widest uppercase"><Plus size={10} />Novo lançamento</button></div>
                  : <>
                      {cms.releases.map(r => (
                        <div key={r.id} className={`border mb-1 ${r.hidden ? "border-border/40 opacity-50" : "border-border"}`}>
                          <div className="flex items-center gap-2 p-2">
                            <div className="w-10 h-10 flex-shrink-0 overflow-hidden border border-border">
                              {r.coverUrl ? <img src={r.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Disc size={12} className="text-muted-foreground" /></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{r.title}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-mono text-[9px] text-muted-foreground">{r.artist}</p>
                                <span className="font-mono text-[8px] px-1 bg-primary/10 text-primary">{releaseLinks(r).length} link(s)</span>
                                <VisibilityBadge hidden={!!r.hidden} />
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => { onClose(); onOpenReleaseForm(r); }} title="Editar" className="font-mono text-[9px] px-2 py-1 border border-border text-muted-foreground hover:border-primary hover:text-primary">✏</button>
                              <VisibilityToggleButton hidden={!!r.hidden} onToggle={() => onToggleHideRelease(r.id)} />
                              <button onClick={() => { if (confirm("Remover lançamento permanentemente?")) onDeleteRelease(r.id); }} title="Deletar permanentemente" className="font-mono text-[9px] px-2 py-1 border border-red-500/40 text-red-400"><Trash2 size={8} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => { onClose(); onOpenReleaseForm(); }} className="flex items-center gap-2 font-mono text-[10px] text-primary border border-primary/30 px-3 py-1.5 hover:bg-primary/10 transition-colors mt-1"><Plus size={10} />Novo lançamento</button>
                    </>}
              </div>
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
          <span className="font-mono text-[10px] text-muted-foreground">{ALL_SEEDS.length + cms.projects.length} proj · {cms.audios.length} áudio · {cms.releases.length} lançamento(s) · {!ghOk ? "⚠ sem token" : "✓ GitHub ok"}</span>
          <button onClick={onClose} className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Fechar</button>
        </div>
      </div>
    </div>
  );
}
