import { useState, useEffect } from "react";
import logoImg from "../../imports/Logo_Freed_Pierre.png";
export const BOOT_SEQUENCE = [
  "INICIALIZANDO SISTEMA...",
  "MONTANDO MÓDULO DE DESIGN...",
  "CARREGANDO ASSETS DE VÍDEO...",
  "SINCRONIZANDO TRILHAS DE ÁUDIO...",
  "RENDERIZANDO MOTION GRAPHICS...",
  "COMPILANDO PORTFÓLIO...",
  "SISTEMA PRONTO.",
];

export function LoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress(p => (p >= 100 ? 100 : Math.min(100, p + Math.random() * 9 + 3)));
    }, 220);
    return () => clearInterval(t);
  }, []);

  const lineIndex = Math.min(BOOT_SEQUENCE.length - 1, Math.floor((progress / 100) * BOOT_SEQUENCE.length));
  const visibleLines = BOOT_SEQUENCE.slice(0, lineIndex + 1).slice(-4);

  return (
    <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center overflow-hidden">
      {/* scanlines CRT */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)" }} />
      {/* grid de fundo com vinheta radial */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: "linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(circle at center, black, transparent 72%)",
          WebkitMaskImage: "radial-gradient(circle at center, black, transparent 72%)",
        }}
      />

      {/* cantos HUD */}
      <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-primary/40" />
      <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-primary/40" />
      <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-primary/40" />
      <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-primary/40" />
      <div className="absolute top-6 left-1/2 -translate-x-1/2 font-mono text-[9px] text-muted-foreground tracking-[0.35em] uppercase hidden sm:block">Rec ● Portfólio.sys</div>
      <div className="absolute bottom-6 right-1/2 translate-x-1/2 font-mono text-[9px] text-muted-foreground tracking-[0.35em] uppercase hidden sm:block">V2.0.26</div>

      <div className="relative z-10 w-[88%] max-w-sm flex flex-col items-center gap-9">
        {/* logo com radar/scan */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary/15" />
          <div className="absolute inset-3 rounded-full border border-primary/10" />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, transparent 0%, var(--primary) 10%, transparent 22%)",
              maskImage: "radial-gradient(circle, transparent 58%, black 60%, black 100%)",
              WebkitMaskImage: "radial-gradient(circle, transparent 58%, black 60%, black 100%)",
              animation: "fp-radar-spin 2.2s linear infinite",
            }}
          />
          <img src={logoImg} alt="" className="relative z-10 h-10 w-auto brightness-200" style={{ animation: "fp-flicker 3.4s infinite" }} />
        </div>

        {/* log de boot estilo terminal */}
        <div className="w-full h-[72px] flex flex-col justify-end font-mono text-[10px] tracking-widest overflow-hidden">
          {visibleLines.map((line, i) => {
            const isLast = i === visibleLines.length - 1;
            return (
              <div key={line} className={`truncate ${isLast ? "text-primary" : "text-muted-foreground opacity-40"}`}>
                {isLast ? "> " : "✓ "}{line}{isLast && <span className="inline-block w-1.5 h-2.5 bg-primary ml-1 align-middle" style={{ animation: "fp-caret 0.9s steps(1) infinite" }} />}
              </div>
            );
          })}
        </div>

        {/* barra de progresso HUD */}
        <div className="w-full">
          <div className="flex justify-between font-mono text-[10px] text-primary tracking-[0.3em] mb-2">
            <span>BOOT.EXE</span>
            <span className="tabular-nums">{Math.floor(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-muted/40 border border-primary/30 relative overflow-hidden">
            <div className="h-full bg-primary transition-all duration-150 ease-out" style={{ width: `${progress}%`, boxShadow: "0 0 14px var(--primary)" }} />
            <div className="absolute inset-0 flex">
              {Array.from({ length: 24 }).map((_, i) => <div key={i} className="flex-1 border-r border-background/50 last:border-r-0" />)}
            </div>
          </div>
          <div className="mt-3 text-center font-mono text-[9px] text-muted-foreground tracking-[0.25em] uppercase">Freed Pierre · Design / Motion / Vídeo / Áudio</div>
        </div>
      </div>

      <style>{`
        @keyframes fp-radar-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fp-flicker { 0%,100%{opacity:1} 91%{opacity:1} 92%{opacity:.35} 93%{opacity:1} 96%{opacity:.55} 97%{opacity:1} }
        @keyframes fp-caret { 0%,49%{opacity:1} 50%,100%{opacity:0} }
      `}</style>
    </div>
  );
}
