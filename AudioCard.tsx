import { Music, Play, Pause, Trash2 } from "lucide-react";
import type { CMSAudio } from "../lib/types";
import { useTapHandler } from "../hooks/useTapHandler";
export function AudioCard({ audio, isActive, isPlaying, onToggle, onDelete, showAdmin, size = "md" }: {
  audio: CMSAudio; isActive: boolean; isPlaying: boolean;
  onToggle: (id: string) => void; onDelete?: (id: string) => void; showAdmin: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const tap = useTapHandler(() => onToggle(audio.id));
  const imgSize = size === "lg" ? "w-48 h-48" : size === "sm" ? "w-28 h-28" : "w-36 h-36 md:w-44 md:h-44";
  return (
    <div className="flex-shrink-0 group relative" style={{ width: size === "lg" ? 192 : size === "sm" ? 112 : undefined }}>
      <div
        className={`relative overflow-hidden cursor-pointer border transition-colors ${imgSize} ${isActive ? "border-primary/60" : "border-border hover:border-primary/40"}`}
        {...tap}
      >
        {audio.coverUrl
          ? <img src={audio.coverUrl} alt={audio.title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full bg-card flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1A1E2B 0%, #0F111A 100%)" }}>
              <Music size={size === "lg" ? 40 : 24} className="text-muted-foreground/40" />
            </div>}
        <div className={`absolute inset-0 bg-background/40 flex items-center justify-center transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <div className="w-10 h-10 bg-primary flex items-center justify-center">
            {isPlaying ? <Pause size={16} className="text-background" /> : <Play size={16} className="text-background ml-0.5" />}
          </div>
        </div>
        {isActive && isPlaying && (
          <div className="absolute top-2 right-2 flex gap-0.5 items-end h-4">
            {[3, 5, 4, 6, 3].map((h, i) => <div key={i} className="w-0.5 bg-primary animate-pulse rounded-full" style={{ height: `${h * 2}px`, animationDelay: `${i * 0.15}s` }} />)}
          </div>
        )}
        {audio.genre && (
          <div className="absolute bottom-1.5 left-1.5">
            <span className="font-mono text-[8px] tracking-wider uppercase bg-background/80 text-primary px-1.5 py-0.5">{audio.genre}</span>
          </div>
        )}
      </div>
      <div className="pt-2 max-w-full">
        <p className="text-sm font-bold text-foreground truncate leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{audio.title}</p>
        {audio.artist && <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">{audio.artist}</p>}
      </div>
      {showAdmin && onDelete && (
        <button onPointerDown={e => e.stopPropagation()} onClick={() => onDelete(audio.id)} className="absolute top-1 right-1 w-6 h-6 bg-background/80 border border-red-500/50 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={9} />
        </button>
      )}
    </div>
  );
}
