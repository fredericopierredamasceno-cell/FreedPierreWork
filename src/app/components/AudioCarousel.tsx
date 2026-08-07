import { Music } from "lucide-react";
import type { CMSAudio } from "../lib/types";
import { CATEGORY_COLORS } from "../lib/defaults";
import { useCarouselScroll } from "../hooks/useCarouselScroll";
import { useAudioPlayerState, useSyncPlaylist } from "../contexts/AudioPlayerContext";
import { FeaturedAudioCard } from "./FeaturedAudioCard";
import { AudioCoverThumb } from "./AudioCoverThumb";
import { MiniPlayer } from "./MiniPlayer";

export function AudioCarousel({ audios, showAdmin, onDelete }: {
  audios: CMSAudio[]; showAdmin: boolean; onDelete: (id: string) => void;
}) {
  const { activeId, isPlaying, activeAudio, toggle } = useAudioPlayerState();
  useSyncPlaylist(audios);
  const handleToggle = (id: string) => toggle(id, audios);

  // Prioridade da capa principal: (1) música fixada manualmente no admin,
  // (2) música em reprodução no momento, (3) mais recente, como fallback quando
  // nada está tocando e nada está fixado.
  const pinnedAudio = audios.find(a => a.isFeatured) ?? null;
  const featuredAudio = pinnedAudio ?? activeAudio ?? audios[0] ?? null;

  // Carrossel abaixo mostra apenas "as demais produções" — nunca repete a capa em destaque.
  const carouselAudios = featuredAudio ? audios.filter(a => a.id !== featuredAudio.id) : audios;

  const { scrollRef, canLeft, canRight, updateArrows, scroll, onWheel } = useCarouselScroll(carouselAudios.length);

  if (audios.length === 0 && !showAdmin) return null;

  // Miniaturas do carrossel: apenas a capa (sem título/artista) — a capa em
  // destaque acima é ~30% maior (ver FeaturedAudioCard: 144px vs 96px aqui).
  const THUMB_SIZE = 96;

  return (
    <div className="space-y-4 w-full" style={{ maxWidth: "100%" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-5 flex-shrink-0 rounded-sm" style={{ background: CATEGORY_COLORS["Produção Fonográfica"] }} />
          <span className="font-black uppercase text-foreground text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Produções</span>
          <span className="font-mono text-[9px] text-muted-foreground">{audios.length} faixa{audios.length !== 1 ? "s" : ""}</span>
        </div>
        {carouselAudios.length > 0 && (
          <div className="flex gap-1">
            {(["left", "right"] as const).map(dir => (
              <button key={dir} onClick={() => scroll(dir)} disabled={dir === "left" ? !canLeft : !canRight}
                className={`w-7 h-7 border flex items-center justify-center text-xs font-bold transition-all ${(dir === "left" ? canLeft : canRight) ? "border-border text-muted-foreground hover:border-primary hover:text-primary" : "border-border/30 text-muted-foreground/20 cursor-not-allowed"}`}>
                {dir === "left" ? "‹" : "›"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nível 1 — Produção em destaque */}
      {featuredAudio && (
        <FeaturedAudioCard audio={featuredAudio} playlist={audios} showAdmin={showAdmin} onDelete={showAdmin ? onDelete : undefined} />
      )}

      {/* Nível 2 — Carrossel horizontal apenas com as capas das demais produções */}
      {carouselAudios.length > 0 && (
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity ${canRight ? "opacity-100" : "opacity-0"}`} />
          <div
            ref={scrollRef} onScroll={updateArrows} onWheel={onWheel}
            className="flex gap-3 pb-2"
            style={{ overflowX: "auto", width: "100%", maxWidth: "100%", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-x" }}
          >
            {carouselAudios.map(a => (
              <div key={a.id} data-card className="flex-shrink-0" style={{ scrollSnapAlign: "start" }}>
                <AudioCoverThumb audio={a} isActive={activeId === a.id} isPlaying={activeId === a.id && isPlaying} onToggle={handleToggle} onDelete={showAdmin ? onDelete : undefined} showAdmin={showAdmin} size={THUMB_SIZE} />
              </div>
            ))}
            <div className="flex-shrink-0 w-2" />
          </div>
        </div>
      )}

      <MiniPlayer />

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
