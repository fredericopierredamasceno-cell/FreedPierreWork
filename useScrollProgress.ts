import { useState, useEffect } from "react";
export function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const fn = () => { const el = document.documentElement; const max = el.scrollHeight - el.clientHeight; setP(max > 0 ? el.scrollTop / max : 0); };
    window.addEventListener("scroll", fn, { passive: true }); return () => window.removeEventListener("scroll", fn);
  }, []);
  return p;
}
