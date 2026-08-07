import { motion } from "motion/react";
import { Music, Play, Pause, Trash2 } from "lucide-react";
import type { CMSAudio } from "../lib/types";
import { useTapHandler } from "../hooks/useTapHandler";
import { COVER_TRANSITION } from "../lib/audioShowcase";

/**
 * Item do carrossel horizontal de "Produções". Diferente do AudioCard (usado
 * na galeria/admin), aqui só a capa é exibida — sem título/artista/texto —
 * para manter o carrossel como uma faixa de capas, não uma lista/playlist.
 *
 * O tamanho NÃO é definido aqui: o wrapper (AudioCarousel) controla largura/altura
 * via CSS var `--cell` para manter a proporção exata com a capa em destaque.
 * A imagem usa `layoutId` compartilhado com a capa em destaque (mesma chave por
 * áudio) — quando esta miniatura vira a capa principal (ou vice-versa), a Motion
 * anima a transição de posição/tamanho automaticamente, em vez de trocar
 * instantaneamente.
 */
export function AudioCoverThumb({ audio, isActive, isPlaying, onToggle, onDelete, showAdmin }: {
  audio: CMSAudio; isActive: boolean; isPlaying: boolean;
  onToggle: (id: string) => void; onDelete?: (id: string) => void; showAdmin?: boolean;
}) {
  const tap = useTapHandler(() => onToggle(audio.id));
  return (
    <div
      className={`relative w-full h-full overflow-hidden cursor-pointer border flex-shrink-0 transition-colors group ${isActive ? "border-primary/60" : "border-border hover:border-primary/40"}`}
      title={audio.artist ? `${audio.title} — ${audio.artist}` : audio.title}
      {...tap}
    >
      {audio.coverUrl
        ? <motion.img layoutId={`audio-cover-${audio.id}`} transition={COVER_TRANSITION} src={audio.coverUrl} alt={audio.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        : <motion.div layoutId={`audio-cover-${audio.id}`} transition={COVER_TRANSITION} className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1A1E2B 0%, #0F111A 100%)" }}>
            <Music size={20} className="text-muted-foreground/40" />
          </motion.div>}
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
