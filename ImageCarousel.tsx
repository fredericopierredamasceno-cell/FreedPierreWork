import { useState, useRef } from "react";
import type React from "react";
import { ChevronLeft, ChevronRight, ZoomIn, X } from "lucide-react";

export function ImageCarousel({ images, title, fullscreen }: { images: string[]; title: string; fullscreen?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  const clamp = (i: number) => (i + images.length) % images.length;
  const prev = () => setIdx(i => clamp(i - 1));
  const next = () => setIdx(i => clamp(i + 1));

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => { startX.current = e.clientX; dragging.current = true; },
    onPointerUp: (e: React.PointerEvent) => {
      if (startX.current === null) return;
      const dx = e.clientX - startX.current;
      startX.current = null; dragging.current = false;
      if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    },
    onPointerCancel: () => { startX.current = null; dragging.current = false; },
  };

  if (images.length === 0) return null;

  return (
    <div className="relative w-full h-full select-none overflow-hidden" {...handlers} style={{ touchAction: "pan-y" }}>
      {/* Trilho deslizante — animação suave em vez de troca abrupta de imagem */}
      <div
        className="flex w-full h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {images.map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt={`${title} ${i + 1}`}
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
          {images.map((_, i) => (
            <button
              key={i}
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
          <img src={images[idx]} alt={title} className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center border border-border text-foreground"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
