import { LayoutGroup } from "motion/react";
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

  // Carrossel mostra apenas "as demais produções" — a capa em destaque nunca
  // repete aqui, já que a mesma capa nunca existe em dois lugares ao mesmo
  // tempo (é isso que permite a animação de "subir" para o destaque via
  // layoutId, ver FeaturedAudioCard / AudioCoverThumb).
  const carouselAudios = featuredAudio ? audios.filter(a => a.id !== featuredAudio.id) : audios;

  const { scrollRef, canLeft, canRight, updateArrows, scroll, onWheel, onPointerDown, dragging } = useCarouselScroll(carouselAudios.length);

  if (audios.length === 0 && !showAdmin) return null;

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

      {/*
        Vitrine — a capa em destaque fica sobreposta (z-index) à esquerda, e o
        carrossel de capas atravessa toda a largura passando visualmente por
        trás dela. Um espaçador invisível do tamanho exato da capa (--cell)
        abre a fila ANTES da primeira miniatura, então nenhuma capa nasce
        "de fábrica" já encoberta e inacessível — a sobreposição só acontece
        de forma dinâmica, conforme o usuário rola (e é sempre reversível
        rolando de volta). `--cell` define o tamanho (quadrado) da capa em
        destaque; a miniatura do carrossel usa sempre --cell / 1.3, garantindo
        os ~30% de diferença em qualquer largura de tela.
      */}
      {(featuredAudio || carouselAudios.length > 0) && (
        <LayoutGroup id="audio-cover">
          <div className="relative w-full [--cell:min(70vw,224px)] md:[--cell:140px] lg:[--cell:156px] h-[var(--cell)]">
            {/* Nível 2 — carrossel horizontal, atrás (z-0), somente capas quadradas */}
            {carouselAudios.length > 0 && (
              <div className="absolute inset-0 z-0">
                <div
                  ref={scrollRef} onScroll={updateArrows} onWheel={onWheel} onPointerDown={onPointerDown}
                  onDragStart={e => e.preventDefault()}
                  className={`h-full flex items-center gap-3 md:gap-3.5 select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                  style={{ overflowX: "auto", scrollSnapType: dragging ? "none" : "x proximity", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-x" }}
                >
                  {/* Espaçador — reserva o espaço exatamente coberto pela capa em destaque,
                      garantindo que a primeira miniatura nasça visível, fora da sobreposição. */}
                  <div className="flex-shrink-0" style={{ width: "var(--cell)", scrollSnapAlign: "none" }} aria-hidden="true" />
                  {carouselAudios.map(a => (
                    <div key={a.id} data-card className="relative flex-shrink-0 w-[calc(var(--cell)/1.3)] h-[calc(var(--cell)/1.3)]" style={{ scrollSnapAlign: "start" }}>
                      <AudioCoverThumb audio={a} isActive={activeId === a.id} isPlaying={activeId === a.id && isPlaying} onToggle={handleToggle} onDelete={showAdmin ? onDelete : undefined} showAdmin={showAdmin} />
                    </div>
                  ))}
                  <div className="flex-shrink-0 w-3" />
                </div>
                {/* fade indicando mais capas à direita */}
                <div className={`absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent pointer-events-none transition-opacity ${canRight ? "opacity-100" : "opacity-0"}`} />
              </div>
            )}

            {/* Nível 1 — capa em destaque, sobreposta à esquerda (z-20, opaca) */}
            {featuredAudio && (
              <div className="absolute left-0 top-0 z-20 w-[var(--cell)] h-[var(--cell)]">
                <FeaturedAudioCard audio={featuredAudio} playlist={audios} showAdmin={showAdmin} onDelete={showAdmin ? onDelete : undefined} />
              </div>
            )}
          </div>
        </LayoutGroup>
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
