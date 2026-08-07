import { useCallback, useRef, useState } from "react";
import type React from "react";
import { Music, Loader2, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react";
import { fmtTime } from "../lib/format";
import { useAudioPlayerState, useAudioPlayerProgress } from "../contexts/AudioPlayerContext";

export function MiniPlayer() {
  const { activeAudio, isPlaying, muted, setMuted, loading, hasNext, hasPrev, toggle, playNext, playPrev, audioElRef } = useAudioPlayerState();
  const { currentTime, duration, seekToRatio } = useAudioPlayerProgress();

  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // Pointer Events unificam mouse, touch (Android) e caneta/touch (iPhone),
  // então clique e arraste funcionam com o mesmo código em todas as plataformas.
  const ratioFromEvent = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    return r.width > 0 ? x / r.width : 0;
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    seekToRatio(ratioFromEvent(e));
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    seekToRatio(ratioFromEvent(e));
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!activeAudio) return null;

  const progressPct = duration > 0 && isFinite(duration) ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="border border-border bg-card/60 p-3 flex items-center gap-3">
      <div className="w-9 h-9 flex-shrink-0 overflow-hidden border border-border">
        {activeAudio.coverUrl ? <img src={activeAudio.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Music size={12} className="text-muted-foreground" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{activeAudio.title}</p>
        {activeAudio.artist && <p className="font-mono text-[9px] text-muted-foreground truncate">{activeAudio.artist}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-mono text-[9px] text-muted-foreground tabular-nums w-9 flex-shrink-0">{fmtTime(currentTime)}</span>
          <div
            ref={barRef}
            className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden cursor-pointer touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="font-mono text-[9px] text-muted-foreground tabular-nums w-9 flex-shrink-0 text-right">{duration > 0 && isFinite(duration) ? fmtTime(duration) : "--:--"}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={playPrev}
          disabled={!hasPrev}
          aria-label="Música anterior"
          className={`w-7 h-7 border flex items-center justify-center transition-colors ${hasPrev ? "border-border text-muted-foreground hover:border-primary hover:text-primary" : "border-border/30 text-muted-foreground/20 cursor-not-allowed"}`}
        >
          <SkipBack size={12} />
        </button>
        {loading
          ? <div className="w-8 h-8 bg-primary/20 flex items-center justify-center"><Loader2 size={13} className="animate-spin text-primary" /></div>
          : <button onClick={() => toggle(activeAudio.id)} aria-label={isPlaying ? "Pausar" : "Tocar"} className="w-8 h-8 bg-primary flex items-center justify-center text-background">
              {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
            </button>}
        <button
          onClick={playNext}
          disabled={!hasNext}
          aria-label="Próxima música"
          className={`w-7 h-7 border flex items-center justify-center transition-colors ${hasNext ? "border-border text-muted-foreground hover:border-primary hover:text-primary" : "border-border/30 text-muted-foreground/20 cursor-not-allowed"}`}
        >
          <SkipForward size={12} />
        </button>
        <button onClick={() => { setMuted(!muted); if (audioElRef.current) audioElRef.current.muted = !muted; }} className="w-7 h-7 border border-border text-muted-foreground flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
      </div>
    </div>
  );
}
