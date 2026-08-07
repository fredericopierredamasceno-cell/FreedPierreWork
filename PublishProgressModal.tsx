import { X, CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";
import type { PublishStep } from "../lib/types";
export function PublishProgressModal({ open, steps, onClose }: { open: boolean; steps: PublishStep[]; onClose: () => void }) {
  const allDone = steps.length > 0 && steps.every(s => s.status === "done");
  const hasError = steps.some(s => s.status === "error");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/96 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md bg-card border border-border">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">GitHub + Vercel</div>
            <h2 className="text-xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {hasError ? "Falha" : allDone ? "Publicado!" : "Publicando..."}
            </h2>
          </div>
          {(allDone || hasError) && <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border border-border text-muted-foreground"><X size={14} /></button>}
        </div>
        <div className="p-6 space-y-3">
          {steps.map((step, i) => (
            <div key={step.id} className={`flex items-start gap-3 transition-opacity ${i > 0 && steps[i-1].status === "pending" ? "opacity-25" : "opacity-100"}`}>
              <div className="flex-shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center">
                {step.status === "done" && <CheckCircle2 size={16} className="text-green-400" />}
                {step.status === "running" && <Loader2 size={16} className="text-primary animate-spin" />}
                {step.status === "error" && <XCircle size={16} className="text-red-400" />}
                {step.status === "pending" && <div className="w-2.5 h-2.5 rounded-full border border-border" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${step.status === "done" ? "text-green-400" : step.status === "running" ? "text-primary" : step.status === "error" ? "text-red-400" : "text-muted-foreground"}`}>{step.label}</span>
                {step.error && <p className="font-mono text-[10px] text-red-400 mt-0.5 break-all">{step.error}</p>}
              </div>
            </div>
          ))}
        </div>
        {(allDone || hasError) && (
          <div className="px-6 pb-5 border-t border-border pt-4 space-y-3">
            {allDone && <div className="flex items-start gap-2 text-sm text-muted-foreground font-light"><Clock size={13} className="text-amber-400 flex-shrink-0 mt-0.5" /><span>Site ao vivo em ~1–2 min.</span></div>}
            <button onClick={onClose} className={`w-full py-2.5 font-bold text-xs tracking-widest uppercase ${allDone ? "bg-primary text-background" : "border border-border text-muted-foreground"}`}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}
