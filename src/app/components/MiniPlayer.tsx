import { Music, Loader2, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { fmtTime } from "../lib/format";
import type { useAudioPlayer } from "../hooks/useAudioPlayer";
export function MiniPlayer({ player }: { player: ReturnType<typeof useAudioPlayer> }) {
  const { activeAudio, isPlaying, currentTime, duration, muted, setMuted, loading, toggle, seekTo, audioElRef } = player;
  if (!activeAudio) return null;
  return (
    <div className="border border-border bg-card/60 p-3 flex items-center gap-3">
      <div className="w-9 h-9 flex-shrink-0 overflow-hidden border border-border">
        {activeAudio.coverUrl ? <img src={activeAudio.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Music size={12} className="text-muted-foreground" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{activeAudio.title}</p>
        {activeAudio.artist && <p className="font-mono text-[9px] text-muted-foreground truncate">{activeAudio.artist}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-mono text-[9px] text-muted-foreground tabular-nums w-8 flex-shrink-0">{fmtTime(currentTime)}</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden cursor-pointer" onClick={seekTo}>
            <div className="h-full bg-primary rounded-full" style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }} />
          </div>
          <span className="font-mono text-[9px] text-muted-foreground tabular-nums w-8 flex-shrink-0 text-right">{duration > 0 ? fmtTime(duration) : "--:--"}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {loading
          ? <div className="w-8 h-8 bg-primary/20 flex items-center justify-center"><Loader2 size={13} className="animate-spin text-primary" /></div>
          : <button onClick={() => toggle(activeAudio.id)} className="w-8 h-8 bg-primary flex items-center justify-center text-background">
              {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
            </button>}
        <button onClick={() => { setMuted(!muted); if (audioElRef.current) audioElRef.current.muted = !muted; }} className="w-7 h-7 border border-border text-muted-foreground flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
      </div>
    </div>
  );
}
