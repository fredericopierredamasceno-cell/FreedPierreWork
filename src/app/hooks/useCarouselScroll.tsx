import { useState, useRef, useCallback, useLayoutEffect } from "react";
import type React from "react";
export function useCarouselScroll(itemsSignature?: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  // Recalcula as setas ao montar, quando a lista de itens muda e quando a viewport é redimensionada
  // (corrige estado inicial incorreto das setas e desalinhos entre breakpoints)
  useLayoutEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateArrows());
    ro.observe(el);
    window.addEventListener("resize", updateArrows);
    return () => { ro.disconnect(); window.removeEventListener("resize", updateArrows); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateArrows, itemsSignature]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current; if (!el) return;
    const cardW = (el.querySelector("[data-card]") as HTMLElement)?.offsetWidth ?? 260;
    el.scrollBy({ left: dir === "left" ? -(cardW * 2 + 12) : (cardW * 2 + 12), behavior: "smooth" });
  };

  const onWheel = (e: React.WheelEvent) => {
    const el = scrollRef.current; if (!el) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // touchpad já lida com isso nativamente
    const atStart = el.scrollLeft <= 0;
    const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
    // Se o carrossel já está no início/fim na direção do scroll, deixa o scroll vertical
    // da página continuar normalmente — evita "travar" a página ao passar o mouse por cima.
    if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
    e.preventDefault();
    el.scrollBy({ left: e.deltaY, behavior: "auto" });
  };

  return { scrollRef, canLeft, canRight, updateArrows, scroll, onWheel };
}
