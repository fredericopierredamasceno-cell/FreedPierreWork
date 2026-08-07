import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { X, MessageCircle, Pin, PinOff, Trash2, ArrowUpRight } from "lucide-react";
import type { CMSAudio, DisplayProject } from "../lib/types";
import { AUDIO_SERVICE_TITLE } from "../lib/defaults";
import { ImageCarousel } from "./ImageCarousel";
import { ProjectCard } from "./ProjectCard";
import { AudioGalleryView } from "./AudioGalleryView";
export function GalleryModal({ service, allProjects, audios, initialItem, onClose, showAdmin, onDelete, onDeleteAudio, onTogglePin, pinned }: {
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
              <div className="bg-black flex items-center justify-center group" style={{ minHeight: "clamp(200px,42vw,380px)" }}>
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
