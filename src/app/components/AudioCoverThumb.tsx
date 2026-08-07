import { Music, Play, Pause, Trash2 } from "lucide-react";
import type { CMSAudio } from "../lib/types";
import { useTapHandler } from "../hooks/useTapHandler";

/**
 * Item do carrossel horizontal de "Produções". Diferente do AudioCard (usado
 * na galeria/admin), aqui só a capa é exibida — sem título/artista abaixo —
 * para manter o carrossel como uma faixa de capas, não uma lista/playlist.
 */
export function AudioCoverThumb({ audio, isActive, isPlaying, onToggle, onDelete, showAdmin, size = 96 }: {
  audio: CMSAudio; isActive: boolean; isPlaying: boolean;
  onToggle: (id: string) => void; onDelete?: (id: string) => void; showAdmin?: boolean;
  size?: number;
}) {
  const tap = useTapHandler(() => onToggle(audio.id));
  return (
    <div
      className={`relative overflow-hidden cursor-pointer border flex-shrink-0 transition-colors group ${isActive ? "border-primary/60" : "border-border hover:border-primary/40"}`}
      style={{ width: size, height: size }}
      title={audio.artist ? `${audio.title} — ${audio.artist}` : audio.title}
      {...tap}
    >
      {audio.coverUrl
        ? <img src={audio.coverUrl} alt={audio.title} className="w-full h-full object-cover" loading="lazy" />
        : <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1A1E2B 0%, #0F111A 100%)" }}>
            <Music size={20} className="text-muted-foreground/40" />
          </div>}
      <div className={`absolute inset-0 bg-background/40 flex items-center justify-center transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <div className="w-8 h-8 bg-primary flex items-center justify-center">
          {isPlaying ? <Pause size={13} className="text-background" /> : <Play size={13} className="text-background ml-0.5" />}
        </div>
      </div>
      {isActive && isPlaying && (
        <div className="absolute top-1.5 right-1.5 flex gap-0.5 items-end h-3.5">
          {[3, 5, 4, 6, 3].map((h, i) => <div key={i} className="w-0.5 bg-primary animate-pulse rounded-full" style={{ height: `${h * 1.6}px`, animationDelay: `${i * 0.15}s` }} />)}
        </div>
      )}
      {showAdmin && onDelete && (
        <button onPointerDown={e => e.stopPropagation()} onClick={() => onDelete(audio.id)} className="absolute top-1 left-1 w-5 h-5 bg-background/80 border border-red-500/50 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={8} />
        </button>
      )}
    </div>
  );
}
