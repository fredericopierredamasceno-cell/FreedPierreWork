import { useState, useRef, useEffect } from "react";
import type React from "react";
import { ChevronLeft, ChevronRight, ZoomIn, X } from "lucide-react";
import type { GalleryImage } from "../lib/types";

export function ImageCarousel({ images, title, fullscreen, initialIndex = 0 }: { images: GalleryImage[]; title: string; fullscreen?: boolean; initialIndex?: number }) {
  const [idx, setIdx] = useState(() => (initialIndex >= 0 && initialIndex < images.length ? initialIndex : 0));
  const [zoom, setZoom] = useState(false);
  const [dragOffsetPct, setDragOffsetPct] = useState(0); // acompanha o dedo/mouse durante o arraste, estilo Instagram
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const widthRef = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const clamp = (i: number) => (i + images.length) % images.length;
  const prev = () => setIdx(i => clamp(i - 1));
  const next = () => setIdx(i => clamp(i + 1));

  // Navegação por teclado (setas ← →) quando o carrossel está em tela cheia
  useEffect(() => {
    if (!fullscreen) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, images.length]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      startX.current = e.clientX;
      widthRef.current = containerRef.current?.clientWidth || 1;
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (startX.current === null) return;
      const dx = e.clientX - startX.current;
      setDragOffsetPct((dx / widthRef.current) * 100);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (startX.current === null) return;
      const dx = e.clientX - startX.current;
      startX.current = null; setDragOffsetPct(0); setDragging(false);
      if (Math.abs(dx) > widthRef.current * 0.15) { dx < 0 ? next() : prev(); }
    },
    onPointerCancel: () => { startX.current = null; setDragOffsetPct(0); setDragging(false); },
  };

  if (images.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "ArrowLeft") prev(); else if (e.key === "ArrowRight") next(); }}
      {...handlers}
      style={{ touchAction: "pan-y", cursor: images.length > 1 ? "grab" : "default" }}
    >
      {/* Trilho deslizante — segue o arraste em tempo real (estilo Instagram) e anima suavemente ao soltar */}
      <div
        className={`flex w-full h-full ${dragging ? "" : "transition-transform duration-400 ease-out"}`}
        style={{ transform: `translateX(calc(-${idx * 100}% + ${dragOffsetPct}%))` }}
      >
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.url}
            alt={img.alt || `${title} ${i + 1}`}
            className={`w-full h-full flex-shrink-0 ${fullscreen ? "object-contain" : "object-cover"}`}
            loading="lazy"
            draggable={false}
          />
        ))}
      </div>

      {images.length > 1 && (<>
        {/* Setas — visíveis apenas em telas desktop (hover com mouse); no mobile a navegação é por swipe */}
        <button
          onClick={e => { e.stopPropagation(); prev(); }}
          aria-label="Imagem anterior"
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-background/70 text-foreground opacity-0 group-hover:opacity-100 hover:bg-background/90 transition-opacity"
        ><ChevronLeft size={15} /></button>
        <button
          onClick={e => { e.stopPropagation(); next(); }}
          aria-label="Próxima imagem"
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-background/70 text-foreground opacity-0 group-hover:opacity-100 hover:bg-background/90 transition-opacity"
        ><ChevronRight size={15} /></button>

        {/* Indicadores de página */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={e => { e.stopPropagation(); setIdx(i); }}
              aria-label={`Ir para imagem ${i + 1}`}
              className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-foreground/40"}`}
            />
          ))}
        </div>
      </>)}

      {fullscreen && (
        <button onClick={e => { e.stopPropagation(); setZoom(!zoom); }} aria-label="Zoom" className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-background/70 text-foreground">
          <ZoomIn size={13} />
        </button>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[700] bg-background/98 flex items-center justify-center" onClick={() => setZoom(false)}>
          <img src={images[idx].url} alt={title} className="max-w-full max-h-full object-contain" />
          <button onClick={e => { e.stopPropagation(); setZoom(false); }} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center border border-border text-foreground"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
