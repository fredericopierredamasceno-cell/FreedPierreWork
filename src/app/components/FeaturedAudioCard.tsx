import { useCallback, useRef, useState } from "react";
import type React from "react";
import { Music, Play, Pause, Loader2, Trash2 } from "lucide-react";
import type { CMSAudio } from "../lib/types";
import { fmtTime } from "../lib/format";
import { useAudioPlayerState, useAudioPlayerProgress } from "../contexts/AudioPlayerContext";

/**
 * Capa em destaque da seção "Produções". Não possui nenhum <audio> próprio —
 * lê e comanda o player global (AudioPlayerContext), o mesmo usado pelo
 * carrossel e pelo MiniPlayer, garantindo que nunca existam dois players
 * simultâneos.
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
    <div className="relative w-full flex flex-col sm:flex-row gap-4 sm:gap-5 border border-border bg-card/40 p-3 sm:p-4">
      {/* Capa — quase toda a largura no mobile, tamanho fixo (≈30% maior que as miniaturas) a partir do sm */}
      <div className="relative w-full aspect-square sm:w-36 sm:h-36 md:w-40 md:h-40 flex-shrink-0 overflow-hidden border border-border">
        {audio.coverUrl
          ? <img src={audio.coverUrl} alt={audio.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1A1E2B 0%, #0F111A 100%)" }}>
              <Music size={40} className="text-muted-foreground/40" />
            </div>}
        {playingNow && (
          <div className="absolute top-2.5 right-2.5 flex gap-0.5 items-end h-5">
            {[3, 5, 4, 6, 3].map((h, i) => <div key={i} className="w-0.5 bg-primary animate-pulse rounded-full" style={{ height: `${h * 2.4}px`, animationDelay: `${i * 0.15}s` }} />)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-2.5">
        <div>
          <span className="font-mono text-[9px] text-primary tracking-widest uppercase">Produção em destaque</span>
          <p className="text-xl sm:text-2xl font-black text-foreground truncate leading-tight mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{audio.title}</p>
          {audio.artist && <p className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">{audio.artist}</p>}
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3">
          {loadingNow
            ? <div className="w-10 h-10 flex-shrink-0 bg-primary/20 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-primary" /></div>
            : <button onClick={() => toggle(audio.id, playlist)} aria-label={playingNow ? "Pausar" : "Tocar"} className="w-10 h-10 flex-shrink-0 bg-primary flex items-center justify-center text-background">
                {playingNow ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
              </button>}
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-9 flex-shrink-0">{fmtTime(activeTime)}</span>
          <div
            ref={barRef}
            className={`flex-1 h-1.5 bg-muted rounded-full overflow-hidden select-none touch-none ${isActive ? "cursor-pointer" : "cursor-default opacity-70"}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-9 flex-shrink-0 text-right">{activeDuration > 0 && isFinite(activeDuration) ? fmtTime(activeDuration) : "--:--"}</span>
        </div>
      </div>

      {showAdmin && onDelete && (
        <button onPointerDown={e => e.stopPropagation()} onClick={() => onDelete(audio.id)} className="absolute top-2 right-2 w-6 h-6 bg-background/80 border border-red-500/50 text-red-400 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity">
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}
