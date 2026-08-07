import { useState, useRef, useCallback, useLayoutEffect } from "react";
import type React from "react";
export function useCarouselScroll(itemsSignature?: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [dragging, setDragging] = useState(false);

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

  // Arrastar com o MOUSE (desktop). Touch/caneta ficam de fora de propósito —
  // o scroll nativo por swipe já cuida deles com inércia própria do SO, e
  // reimplementar via JS aqui só atrapalharia (perderia a desaceleração nativa).
  // Não usamos setPointerCapture no container: assim os cliques nas miniaturas
  // (que têm sua própria detecção de tap por deslocamento) continuam recebendo
  // os eventos de pointer normalmente, sem retargeting.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = scrollRef.current; if (!el) return;
    const startX = e.clientX;
    const startScrollLeft = el.scrollLeft;
    let moved = false;

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > 3) { moved = true; setDragging(true); }
      if (moved) el.scrollLeft = startScrollLeft - dx;
    };
    const handleUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return { scrollRef, canLeft, canRight, updateArrows, scroll, onWheel, onPointerDown, dragging };
}
