import { useCallback, useRef, useState } from "react";
import type React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Music, Play, Pause, Loader2, Trash2 } from "lucide-react";
import type { CMSAudio } from "../lib/types";
import { fmtTime } from "../lib/format";
import { useAudioPlayerState, useAudioPlayerProgress } from "../contexts/AudioPlayerContext";
import { COVER_TRANSITION } from "../lib/audioShowcase";

/**
 * Capa em destaque da "vitrine" de Produções. Não possui nenhum <audio>
 * próprio — lê e comanda o player global (AudioPlayerContext), o mesmo usado
 * pelo carrossel e pelo MiniPlayer, garantindo que nunca existam dois
 * players simultâneos.
 *
 * A capa (imagem) usa `layoutId={`audio-cover-${audio.id}`}` — a MESMA chave
 * usada pela miniatura equivalente em AudioCoverThumb. Como uma faixa nunca
 * existe nos dois lugares ao mesmo tempo (o carrossel sempre filtra a que já
 * está em destaque), clicar numa miniatura faz essa troca de "dono" do
 * layoutId — a Motion detecta e anima a imagem subindo/expandindo da posição
 * da miniatura até aqui, em vez de trocar instantaneamente.
 */
export function FeaturedAudioCard({ audio, playlist, onDelete, showAdmin }: {
  audio: CMSAudio; playlist: CMSAudio[];
  onDelete?: (id: string) => void; showAdmin?: boolean;
}) {
  const { activeId, isPlaying, loading, toggle } = useAudioPlayerState();
  const { currentTime, duration, seekToRatio } = useAudioPlayerProgress();
  const isActive = activeId === audio.id;

  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const ratioFromEvent = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    return r.width > 0 ? x / r.width : 0;
  }, []);

  // Arrastar/clicar na barra só faz sentido quando esta é de fato a faixa
  // carregada no <audio> global — evita "seekar" uma faixa que nem está tocando.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isActive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    seekToRatio(ratioFromEvent(e));
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !isActive) return;
    seekToRatio(ratioFromEvent(e));
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const activeTime = isActive ? currentTime : 0;
  const activeDuration = isActive ? duration : 0;
  const progressPct = activeDuration > 0 && isFinite(activeDuration) ? Math.min(100, (activeTime / activeDuration) * 100) : 0;
  const playingNow = isActive && isPlaying;
  const loadingNow = isActive && loading;

  return (
    <div className="relative w-full h-full overflow-hidden border border-border bg-card shadow-[0_20px_45px_-14px_rgba(0,0,0,0.6)]">
      {/* Capa — ver nota de layoutId compartilhado acima */}
      {audio.coverUrl
        ? <motion.img layoutId={`audio-cover-${audio.id}`} transition={COVER_TRANSITION} src={audio.coverUrl} alt={audio.title} className="absolute inset-0 w-full h-full object-cover" />
        : <motion.div layoutId={`audio-cover-${audio.id}`} transition={COVER_TRANSITION} className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1A1E2B 0%, #0F111A 100%)" }}>
            <Music size={40} className="text-muted-foreground/40" />
          </motion.div>}

      {/* Gradiente para dar legibilidade ao texto/player sobrepostos na base da capa */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent pointer-events-none" />

      {playingNow && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-background/70 backdrop-blur-sm px-2 py-1 border border-primary/30">
          <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-[8px] text-primary tracking-widest uppercase">Tocando agora</span>
        </div>
      )}

      {showAdmin && onDelete && (
        <button onPointerDown={e => e.stopPropagation()} onClick={() => onDelete(audio.id)} className="absolute top-2.5 left-2.5 z-10 w-6 h-6 bg-background/80 border border-red-500/50 text-red-400 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity">
          <Trash2 size={10} />
        </button>
      )}

      {/* Texto + player: cross-fade curto ao trocar de faixa (a capa em si já anima via layoutId acima) */}
      <AnimatePresence mode="sync">
        <motion.div
          key={audio.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5 flex flex-col gap-2"
        >
          <div>
            <span className="font-mono text-[9px] text-primary tracking-widest uppercase">Produção em destaque</span>
            <p className="text-base sm:text-lg md:text-xl font-black text-foreground truncate leading-tight mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{audio.title}</p>
            {audio.artist && <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">{audio.artist}</p>}
          </div>
          <div className="flex items-center gap-2">
            {loadingNow
              ? <div className="w-8 h-8 flex-shrink-0 bg-primary/20 flex items-center justify-center"><Loader2 size={14} className="animate-spin text-primary" /></div>
              : <button onClick={() => toggle(audio.id, playlist)} aria-label={playingNow ? "Pausar" : "Tocar"} className="w-8 h-8 flex-shrink-0 bg-primary flex items-center justify-center text-background">
                  {playingNow ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>}
            <span className="font-mono text-[9px] text-muted-foreground tabular-nums w-8 flex-shrink-0">{fmtTime(activeTime)}</span>
            <div
              ref={barRef}
              className={`flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden select-none touch-none ${isActive ? "cursor-pointer" : "cursor-default opacity-70"}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="font-mono text-[9px] text-muted-foreground tabular-nums w-8 flex-shrink-0 text-right">{activeDuration > 0 && isFinite(activeDuration) ? fmtTime(activeDuration) : "--:--"}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
