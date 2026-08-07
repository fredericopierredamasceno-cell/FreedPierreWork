import { useState, useEffect, useRef, useCallback } from "react";
import { Film, Youtube, Play, Pin, PinOff, Trash2 } from "lucide-react";
import type { DisplayProject } from "../lib/types";
import { useTapHandler } from "../hooks/useTapHandler";
import { ImageCarousel } from "./ImageCarousel";
export function ProjectCard({ item, onDelete, onTogglePin, isPinned, showAdmin, onClick }: {
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
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ""}</div>
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
