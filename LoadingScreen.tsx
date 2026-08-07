import { useMemo } from "react";
import logoImg from "../../imports/Logo_Freed_Pierre.png";

/* Ciclo curto e suave — o "playhead" varre o painel inteiro nesse tempo,
   disparando o flash sequencial dos keyframes e dos swatches. */
const CYCLE = 2.4;

/* Alturas do waveform pré-computadas (não randômicas) para um contorno
   de onda deliberado, não um jitter aleatório. */
const WAVE_BARS = Array.from({ length: 26 }, (_, i) => {
  const t = i / 25;
  const h = 26 + Math.abs(Math.sin(t * Math.PI * 2.4)) * 62 + Math.sin(t * Math.PI * 9) * 10;
  return Math.max(16, Math.min(100, h));
});

const KEYFRAME_POSITIONS = [0, 25, 50, 75, 100];
const SWATCH_COUNT = 10;

export function LoadingScreen() {
  const waveDelays = useMemo(() => WAVE_BARS.map((_, i) => (i * 0.045).toFixed(3)), []);

  return (
    <div
      className="fixed inset-0 z-[200] bg-background flex items-center justify-center overflow-hidden fp-loading"
      role="status"
      aria-live="polite"
      aria-label="Carregando portfólio"
    >
      {/* textura sutil de fundo — mantém a linguagem do site sem competir com o painel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(circle at center, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at center, black, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-[86%] max-w-xs flex flex-col items-center" style={{ animation: "fp-fadein 0.6s ease-out" }}>
        {/* logo — respiração suave, sem spinner */}
        <img
          src={logoImg}
          alt="Freed Pierre"
          className="h-9 w-auto brightness-200 mb-10"
          style={{ animation: `fp-breathe ${CYCLE}s ease-in-out infinite` }}
        />

        {/* painel de timeline — playhead varrendo 3 trilhas: áudio / motion / design */}
        <div className="relative w-full">
          <div
            className="absolute inset-y-0 w-px bg-primary z-10"
            style={{ animation: `fp-scan ${CYCLE}s linear infinite`, boxShadow: "0 0 10px var(--primary), 0 0 2px var(--primary)" }}
          >
            <span
              className="absolute -top-[5px] -left-[3px] w-[7px] h-[7px] bg-primary"
              style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }}
            />
          </div>

          <div className="flex flex-col gap-5">
            {/* Trilha 1 — Produção Musical: waveform contínuo, vivo */}
            <div>
              <div className="font-mono text-[8px] text-muted-foreground tracking-[0.28em] uppercase mb-2">Produção Musical</div>
              <div className="flex items-end gap-[3px] h-7">
                {WAVE_BARS.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full"
                    style={{
                      height: `${h}%`,
                      background: "var(--primary)",
                      opacity: 0.55,
                      animation: `fp-wave 1.15s ease-in-out ${waveDelays[i]}s infinite alternate`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Trilha 2 — Motion Design: linha de keyframes acesos pelo playhead */}
            <div>
              <div className="font-mono text-[8px] text-muted-foreground tracking-[0.28em] uppercase mb-2">Motion Design</div>
              <div className="relative h-7 flex items-center">
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                {KEYFRAME_POSITIONS.map((pos, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 w-2 h-2 border border-border"
                    style={{
                      left: `${pos}%`,
                      transform: "translate(-50%, -50%) rotate(45deg)",
                      background: "var(--background)",
                      animation: `fp-pulse-diamond ${CYCLE}s ease-in-out ${(pos / 100) * CYCLE}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Trilha 3 — Design Gráfico: swatches/grade acesos em sequência pelo playhead */}
            <div>
              <div className="font-mono text-[8px] text-muted-foreground tracking-[0.28em] uppercase mb-2">Design Gráfico</div>
              <div className="flex items-center gap-[3px] h-7">
                {Array.from({ length: SWATCH_COUNT }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full rounded-[2px] border border-border"
                    style={{
                      background: "var(--muted)",
                      animation: `fp-pulse-swatch ${CYCLE}s ease-in-out ${(i / SWATCH_COUNT) * CYCLE}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-9 font-mono text-[9px] text-muted-foreground tracking-[0.3em] uppercase text-center">
          Preparando experiência
        </div>
      </div>

      <style>{`
        @keyframes fp-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fp-breathe { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; } }
        @keyframes fp-scan { 0% { left: 0%; } 100% { left: 100%; } }
        @keyframes fp-wave { 0% { transform: scaleY(0.55); opacity: 0.4; } 100% { transform: scaleY(1); opacity: 0.85; } }
        @keyframes fp-pulse-diamond {
          0%, 92%, 100% { background: var(--background); border-color: var(--border); box-shadow: none; }
          4% { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 8px var(--primary); }
          16% { background: var(--background); border-color: var(--border); box-shadow: none; }
        }
        @keyframes fp-pulse-swatch {
          0%, 88%, 100% { background: var(--muted); border-color: var(--border); box-shadow: none; }
          4% { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 8px var(--primary); }
          18% { background: var(--muted); border-color: var(--border); box-shadow: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fp-loading * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  );
}
