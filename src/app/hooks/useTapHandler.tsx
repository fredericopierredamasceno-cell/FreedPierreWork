import { useRef } from "react";
import type React from "react";

/* TAP DETECTION — distingue tap intencional de scroll/drag */
export const TAP_THRESHOLD = 12; // px — movimento acima disso cancela o tap
export function useTapHandler(handler: () => void) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      startRef.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!startRef.current) return;
      const dx = Math.abs(e.clientX - startRef.current.x);
      const dy = Math.abs(e.clientY - startRef.current.y);
      startRef.current = null;
      if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) handler();
    },
    onPointerCancel: () => { startRef.current = null; },
  };
}
