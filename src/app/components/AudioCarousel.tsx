import { Music } from "lucide-react";
import type { CMSAudio } from "../lib/types";
import { CATEGORY_COLORS } from "../lib/defaults";
import { useCarouselScroll } from "../hooks/useCarouselScroll";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { AudioCard } from "./AudioCard";
import { MiniPlayer } from "./MiniPlayer";
export function AudioCarousel({ audios, showAdmin, onDelete }: {
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
