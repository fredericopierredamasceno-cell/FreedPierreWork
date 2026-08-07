import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { CMSAudio } from "../lib/types";

/**
 * Player de áudio global do portfólio.
 *
 * Por que um Context único (e não um hook local por componente, como era antes):
 * o carrossel (AudioCarousel) e a galeria (AudioGalleryView, dentro do
 * GalleryModal) podem estar montados ao mesmo tempo. Se cada um tivesse seu
 * próprio estado/`<audio>`, seria possível tocar duas faixas simultaneamente.
 * Com um único Provider e um único elemento <audio> na árvore, isso se torna
 * estruturalmente impossível — trocar de faixa sempre reaproveita a mesma
 * tag de mídia.
 *
 * O estado é dividido em dois contexts para evitar renderizações
 * desnecessárias: `currentTime` muda várias vezes por segundo durante a
 * reprodução, então só os componentes que realmente desenham a barra de
 * progresso (o MiniPlayer) assinam esse valor. Componentes que só precisam
 * saber "qual faixa está ativa" / "está tocando?" (cards da grade/carrossel)
 * não são re-renderizados a cada tick do `timeupdate`.
 */

interface AudioPlayerStateValue {
  activeAudio: CMSAudio | null;
  activeId: string | null;
  isPlaying: boolean;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  loading: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  /** Toca/pausa a faixa `id`. Passe `playlist` ao iniciar uma faixa nova
   *  (define a ordem usada por próxima/anterior/troca automática). Ao
   *  apenas pausar/retomar a faixa já ativa, `playlist` pode ser omitido. */
  toggle: (id: string, playlist?: CMSAudio[]) => void;
  playNext: () => void;
  playPrev: () => void;
  audioElRef: React.RefObject<HTMLAudioElement>;
  /** Registra a playlist ativa (ver hook utilitário `useSyncPlaylist`). */
  syncPlaylist: (list: CMSAudio[]) => void;
}

interface AudioPlayerProgressValue {
  currentTime: number;
  duration: number;
  /** ratio de 0 a 1 relativo à duração total — usado pela barra de progresso (clique e arraste) */
  seekToRatio: (ratio: number) => void;
}

const AudioPlayerStateContext = createContext<AudioPlayerStateValue | null>(null);
const AudioPlayerProgressContext = createContext<AudioPlayerProgressValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioElRef = useRef<HTMLAudioElement>(null);

  const [playlist, setPlaylist] = useState<CMSAudio[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeAudio = useMemo(() => playlist.find(a => a.id === activeId) ?? null, [playlist, activeId]);
  const activeIndex = useMemo(() => playlist.findIndex(a => a.id === activeId), [playlist, activeId]);
  const hasNext = activeIndex >= 0 && activeIndex < playlist.length - 1;
  const hasPrev = activeIndex > 0;

  // Mantém a playlist do CMS sempre atualizada (novas faixas entram
  // automaticamente, sem nenhuma configuração manual). Evita setState (e
  // portanto re-render) quando o conteúdo é o mesmo, mesmo que o componente
  // pai tenha recriado o array por referência.
  const syncPlaylist = useCallback((list: CMSAudio[]) => {
    setPlaylist(prev => {
      const same = prev.length === list.length && prev.every((a, i) =>
        a.id === list[i].id && a.title === list[i].title && a.url === list[i].url && a.coverUrl === list[i].coverUrl
      );
      return same ? prev : list;
    });
  }, []);

  const playId = useCallback((id: string, list: CMSAudio[]) => {
    setPlaylist(list);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);
    setActiveId(id);
  }, []);

  const toggle = useCallback((id: string, list?: CMSAudio[]) => {
    if (activeId === id) {
      // mesma faixa: apenas alterna play/pause
      const el = audioElRef.current;
      if (el) { if (el.paused) el.play().catch(() => {}); else el.pause(); }
      if (list) setPlaylist(list);
    } else if (list) {
      // faixa nova: para a atual (troca de src no único <audio>) e inicia a nova
      playId(id, list);
    }
  }, [activeId, playId]);

  const playNext = useCallback(() => {
    const idx = playlist.findIndex(a => a.id === activeId);
    if (idx >= 0 && idx < playlist.length - 1) playId(playlist[idx + 1].id, playlist);
  }, [playlist, activeId, playId]);

  const playPrev = useCallback(() => {
    const idx = playlist.findIndex(a => a.id === activeId);
    if (idx > 0) playId(playlist[idx - 1].id, playlist);
  }, [playlist, activeId, playId]);

  const handleEnded = useCallback(() => {
    const idx = playlist.findIndex(a => a.id === activeId);
    if (idx >= 0 && idx < playlist.length - 1) {
      // reprodução sequencial: avança automaticamente para a próxima faixa
      playId(playlist[idx + 1].id, playlist);
    } else {
      // última faixa da playlist: interrompe normalmente, sem repetir
      setIsPlaying(false);
      setCurrentTime(0);
      const el = audioElRef.current;
      if (el) el.currentTime = 0;
    }
  }, [playlist, activeId, playId]);

  // Carrega e (tenta) tocar automaticamente sempre que a faixa ativa muda.
  // `el.load()` garante troca confiável da fonte em iOS/Safari, onde apenas
  // mudar o atributo `src` via React nem sempre reinicia o carregamento.
  useEffect(() => {
    const el = audioElRef.current;
    if (!activeId || !el) return;
    setIsPlaying(false);
    el.load();
    const tryPlay = () => el.play().catch(() => setIsPlaying(false));
    if (el.readyState >= 3) { tryPlay(); return; }
    el.addEventListener("canplay", tryPlay, { once: true });
    return () => el.removeEventListener("canplay", tryPlay);
  }, [activeId]);

  const seekToRatio = useCallback((ratio: number) => {
    const el = audioElRef.current;
    if (!el || !duration || !isFinite(duration)) return;
    const time = Math.min(Math.max(ratio, 0), 1) * duration;
    el.currentTime = time;
    setCurrentTime(time);
  }, [duration]);

  const stateValue = useMemo<AudioPlayerStateValue>(() => ({
    activeAudio, activeId, isPlaying, muted, setMuted, loading, hasNext, hasPrev,
    toggle, playNext, playPrev, audioElRef, syncPlaylist,
  }), [activeAudio, activeId, isPlaying, muted, loading, hasNext, hasPrev, toggle, playNext, playPrev, syncPlaylist]);

  const progressValue = useMemo<AudioPlayerProgressValue>(() => ({
    currentTime, duration, seekToRatio,
  }), [currentTime, duration, seekToRatio]);

  return (
    <AudioPlayerStateContext.Provider value={stateValue}>
      <AudioPlayerProgressContext.Provider value={progressValue}>
        {children}
        <audio
          ref={audioElRef}
          src={activeAudio?.url}
          muted={muted}
          preload="metadata"
          style={{ display: "none" }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          onTimeUpdate={() => { const el = audioElRef.current; if (el) setCurrentTime(el.currentTime); }}
          onLoadedMetadata={() => { const el = audioElRef.current; if (el) setDuration(el.duration); setLoading(false); }}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onError={() => { setLoading(false); if (activeId) toast.error("Erro ao carregar áudio."); }}
        />
      </AudioPlayerProgressContext.Provider>
    </AudioPlayerStateContext.Provider>
  );
}

export function useAudioPlayerState() {
  const ctx = useContext(AudioPlayerStateContext);
  if (!ctx) throw new Error("useAudioPlayerState precisa estar dentro de <AudioPlayerProvider>");
  return ctx;
}

export function useAudioPlayerProgress() {
  const ctx = useContext(AudioPlayerProgressContext);
  if (!ctx) throw new Error("useAudioPlayerProgress precisa estar dentro de <AudioPlayerProvider>");
  return ctx;
}

/** Registra `audios` como a playlist ativa (ordem usada por próxima/anterior
 *  e pela troca automática ao final da faixa). Chame no topo de qualquer
 *  componente que exiba uma lista de áudios do CMS. */
export function useSyncPlaylist(audios: CMSAudio[]) {
  const { syncPlaylist } = useAudioPlayerState();
  useEffect(() => { syncPlaylist(audios); }, [audios, syncPlaylist]);
}
