import { Github, X, Loader2, Eye } from "lucide-react";
import type { CMSData } from "../lib/types";
import { ALL_SEEDS, CATEGORIES } from "../lib/defaults";

export function PublishReviewModal({ cms, open, onClose, onConfirm, publishing }: {
  cms: CMSData; open: boolean; onClose: () => void; onConfirm: () => void; publishing: boolean;
}) {
  if (!open) return null;

  const seedsVisible = ALL_SEEDS.filter(s => !cms.hiddenSeeds.includes(s.id));
  const allProjects = [...seedsVisible, ...cms.projects];
  const published = allProjects.filter(p => !p.hidden).length;
  const hidden = allProjects.length - published;
  const audiosPublished = cms.audios.filter(a => !a.hidden).length;

  return (
    <div className="fixed inset-0 z-[400] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" style={{ animation: "fp-admin-fade 0.18s ease-out" }} onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col bg-card border border-border" style={{ animation: "fp-admin-in 0.22s cubic-bezier(0.16,1,0.3,1)" }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-primary" />
            <span className="font-mono text-[10px] text-primary tracking-widest uppercase">Revisar antes de publicar</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"><X size={14} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="border border-border p-4">
            <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mb-2">Hero</div>
            <p className="text-lg font-bold text-foreground leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {cms.content.heroLine1} {cms.content.heroLine2} {cms.content.heroLine3} {cms.content.heroLine4}
            </p>
            <p className="text-sm text-muted-foreground font-light mt-2">{cms.content.heroSubtitle}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="border border-border p-3 text-center">
              <div className="text-xl font-bold text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{published}</div>
              <div className="font-mono text-[8px] text-muted-foreground uppercase tracking-widest mt-1">Publicados</div>
            </div>
            <div className="border border-border p-3 text-center">
              <div className="text-xl font-bold text-muted-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{hidden}</div>
              <div className="font-mono text-[8px] text-muted-foreground uppercase tracking-widest mt-1">Ocultos</div>
            </div>
            <div className="border border-border p-3 text-center">
              <div className="text-xl font-bold text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{audiosPublished}</div>
              <div className="font-mono text-[8px] text-muted-foreground uppercase tracking-widest mt-1">Áudios</div>
            </div>
          </div>

          <div className="border border-border divide-y divide-border">
            {CATEGORIES.map(cat => {
              const total = allProjects.filter(p => p.category === cat).length;
              if (!total) return null;
              return (
                <div key={cat} className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-foreground font-light">{cat}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{total} item(s)</span>
                </div>
              );
            })}
          </div>

          <p className="font-mono text-[9px] text-muted-foreground/70">Confirme que os textos e a visibilidade dos itens estão como você quer. Depois de publicar, o site atualiza em ~1-2 min.</p>
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="font-mono text-xs text-muted-foreground uppercase tracking-widest px-3 py-2">Voltar e editar</button>
          <button onClick={onConfirm} disabled={publishing} className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 font-bold text-xs tracking-widest uppercase disabled:opacity-60">
            {publishing ? <><Loader2 size={12} className="animate-spin" />Publicando...</> : <><Github size={12} />Confirmar e publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
