import { useState, useRef } from "react";
import type React from "react";
import { ChevronLeft, ChevronRight, ZoomIn, X } from "lucide-react";
export function ImageCarousel({ images, title, fullscreen }: { images: string[]; title: string; fullscreen?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const startX = useRef<number | null>(null);

  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => { startX.current = e.clientX; },
    onPointerUp: (e: React.PointerEvent) => {
      if (startX.current === null) return;
      const dx = e.clientX - startX.current;
      startX.current = null;
      if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    },
    onPointerCancel: () => { startX.current = null; },
  };

  if (images.length === 0) return null;

  return (
    <div className="relative w-full h-full select-none" {...handlers} style={{ touchAction: "pan-y" }}>
      <img
        src={images[idx]} alt={`${title} ${idx + 1}`}
        className={`w-full h-full ${fullscreen ? "object-contain" : "object-cover"} transition-opacity duration-200`}
        loading="lazy"
      />
      {images.length > 1 && (<>
        <button onClick={e => { e.stopPropagation(); prev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-background/70 flex items-center justify-center text-foreground"><ChevronLeft size={14} /></button>
        <button onClick={e => { e.stopPropagation(); next(); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-background/70 flex items-center justify-center text-foreground"><ChevronRight size={14} /></button>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {images.map((_, i) => <div key={i} className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-foreground/40"}`} />)}
        </div>
      </>)}
      {fullscreen && <button onClick={e => { e.stopPropagation(); setZoom(!zoom); }} className="absolute top-2 right-2 w-7 h-7 bg-background/70 flex items-center justify-center text-foreground"><ZoomIn size={13} /></button>}
      {zoom && (
        <div className="fixed inset-0 z-[700] bg-background/98 flex items-center justify-center" onClick={() => setZoom(false)}>
          <img src={images[idx]} alt={title} className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center border border-border text-foreground"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
