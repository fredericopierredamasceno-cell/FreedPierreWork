import { useState } from "react";
import { Music } from "lucide-react";
import type { CMSAudio } from "../lib/types";
import { useAudioPlayerState, useSyncPlaylist } from "../contexts/AudioPlayerContext";
import { AudioCard } from "./AudioCard";
import { MiniPlayer } from "./MiniPlayer";
export function AudioGalleryView({ audios, showAdmin, onDeleteAudio }: { audios: CMSAudio[]; showAdmin: boolean; onDeleteAudio: (id: string) => void }) {
  const { activeId, isPlaying, toggle } = useAudioPlayerState();
  useSyncPlaylist(audios);
  const handleToggle = (id: string) => toggle(id, audios);
  const [filterGenre, setFilterGenre] = useState<string>("all");

  const genres = ["all", ...Array.from(new Set(audios.map(a => a.genre).filter(Boolean) as string[]))];
  const filtered = filterGenre === "all" ? audios : audios.filter(a => a.genre === filterGenre);

  if (audios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 px-6">
        <div className="w-12 h-12 border border-border flex items-center justify-center text-muted-foreground"><Music size={24} /></div>
        <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase text-center">Nenhuma produção cadastrada ainda</p>
        {showAdmin && <p className="font-mono text-[10px] text-muted-foreground/50 text-center">Faça upload de áudios no painel admin</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Genre filter */}
      {genres.length > 1 && (
        <div className="flex gap-2 px-5 md:px-8 py-3 border-b border-border flex-wrap">
          {genres.map(g => (
            <button key={g} onClick={() => setFilterGenre(g)} className={`font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 border transition-colors ${filterGenre === g ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}>
              {g === "all" ? "Todos" : g}
            </button>
          ))}
        </div>
      )}
      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 md:px-8 py-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map(a => (
            <div key={a.id} className="group">
              <AudioCard audio={a} isActive={activeId === a.id} isPlaying={activeId === a.id && isPlaying} onToggle={handleToggle} onDelete={showAdmin ? onDeleteAudio : undefined} showAdmin={showAdmin} size="md" />
            </div>
          ))}
        </div>
      </div>
      {/* Player bar */}
      <div className="border-t border-border px-5 md:px-8 py-3">
        <MiniPlayer />
      </div>
    </div>
  );
}
