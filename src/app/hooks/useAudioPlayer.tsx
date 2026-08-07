import { useState, useEffect, useRef, useCallback } from "react";
import type React from "react";
import { toast } from "sonner";
import type { CMSAudio } from "../lib/types";
/* AudioPlayer hook — reutilizável no carrossel e na galeria */
export function useAudioPlayer(audios: CMSAudio[]) {
  const audioElRef = useRef<HTMLAudioElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const activeAudio = audios.find(a => a.id === activeId) ?? null;

  const toggle = useCallback((id: string) => {
    const el = audioElRef.current;
    if (activeId === id && el) {
      if (el.paused) el.play().catch(() => {});
      else el.pause();
    } else {
      setActiveId(id); setCurrentTime(0); setDuration(0); setLoading(true);
    }
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const el = audioElRef.current; if (!el) return;
    setIsPlaying(false);
    const tryPlay = () => el.play().catch(() => setIsPlaying(false));
    if (el.readyState >= 3) tryPlay();
    else el.addEventListener("canplay", tryPlay, { once: true });
  }, [activeId]);

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioElRef.current; if (!el || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };

  const audioEl = activeAudio ? (
    <audio
      key={activeAudio.id}
      ref={audioElRef}
      src={activeAudio.url}
      muted={muted}
      preload="metadata"
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      onEnded={() => { setIsPlaying(false); setActiveId(null); }}
      onTimeUpdate={() => { const el = audioElRef.current; if (el) setCurrentTime(el.currentTime); }}
      onLoadedMetadata={() => { const el = audioElRef.current; if (el) setDuration(el.duration); setLoading(false); }}
      onWaiting={() => setLoading(true)}
      onCanPlay={() => setLoading(false)}
      onError={() => { setLoading(false); toast.error("Erro ao carregar áudio."); }}
    />
  ) : null;

  return { activeAudio, activeId, isPlaying, currentTime, duration, muted, setMuted, loading, toggle, seekTo, audioEl, audioElRef };
}
