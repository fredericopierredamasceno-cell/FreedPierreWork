import type { ReactNode } from "react";
import { LayoutGrid, Eye, EyeOff, Music, Clock } from "lucide-react";
import type { CMSData, DisplayProject } from "../lib/types";
import { ALL_SEEDS, CATEGORY_COLORS, CATEGORIES } from "../lib/defaults";

/* Painel de visão geral do Admin. Não é fonte de verdade de nada — apenas
   lê `cms` (+ seeds do código) e calcula indicadores. Nenhum dado é
   duplicado ou gravado aqui. */
export function DashboardTab({ cms }: { cms: CMSData }) {
  const seedsVisible: DisplayProject[] = ALL_SEEDS.filter(s => !cms.hiddenSeeds.includes(s.id));
  const allProjects: DisplayProject[] = [...seedsVisible, ...cms.projects];

  const publishedProjects = allProjects.filter(p => !p.hidden).length;
  const hiddenProjects = cms.projects.filter(p => p.hidden).length + (ALL_SEEDS.length - seedsVisible.length);

  const publishedAudios = cms.audios.filter(a => !a.hidden).length;
  const hiddenAudios = cms.audios.filter(a => a.hidden).length;

  const byCategory = CATEGORIES.map(cat => ({
    category: cat,
    total: allProjects.filter(p => p.category === cat).length,
    published: allProjects.filter(p => p.category === cat && !p.hidden).length,
  }));

  // "Adicionado" = createdAt. "Editado" = updatedAt, quando existir e for
  // depois da criação (edição real, não só o registro inicial).
  type RecentItem = { id: string; title: string; kind: string; ts: number; edited: boolean };
  const recent: RecentItem[] = [
    ...cms.projects.map(p => ({ id: p.id, title: p.title, kind: p.category, ts: Math.max(p.createdAt, p.updatedAt ?? 0), edited: !!p.updatedAt && p.updatedAt > p.createdAt })),
    ...cms.audios.map(a => ({ id: a.id, title: a.title, kind: "Áudio", ts: Math.max(a.createdAt, a.updatedAt ?? 0), edited: !!a.updatedAt && a.updatedAt > a.createdAt })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 6);

  const StatCard = ({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone?: string }) => (
    <div className="border border-border p-4 flex items-center gap-3">
      <div className={`w-9 h-9 flex items-center justify-center flex-shrink-0 ${tone ?? "bg-primary/10 text-primary"}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-foreground leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</div>
        <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mt-1 truncate">{label}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Eye size={16} />} value={publishedProjects} label="Publicados" />
        <StatCard icon={<EyeOff size={16} />} value={hiddenProjects} label="Ocultos" tone="bg-muted text-muted-foreground" />
        <StatCard icon={<Music size={16} />} value={publishedAudios} label="Áudios publicados" />
        <StatCard icon={<EyeOff size={16} />} value={hiddenAudios} label="Áudios ocultos" tone="bg-muted text-muted-foreground" />
      </div>

      <div>
        <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2">
          <LayoutGrid size={11} className="text-primary" />Por categoria
        </div>
        <div className="border border-border divide-y divide-border">
          {byCategory.map(c => (
            <div key={c.category} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-2 h-2 flex-shrink-0" style={{ background: CATEGORY_COLORS[c.category] ?? "var(--primary)" }} />
              <span className="flex-1 text-sm text-foreground font-light">{c.category}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{c.published}/{c.total} publicados</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-2">
          <Clock size={11} className="text-primary" />Atividade recente
        </div>
        {recent.length === 0
          ? <div className="border border-dashed border-border py-8 text-center"><p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Nada por aqui ainda</p></div>
          : <div className="border border-border divide-y divide-border">
              {recent.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 text-sm text-foreground font-light truncate">{r.title}</span>
                  <span className={`font-mono text-[8px] px-1.5 py-0.5 uppercase flex-shrink-0 ${r.edited ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{r.edited ? "Editado" : "Adicionado"}</span>
                  <span className="font-mono text-[9px] text-muted-foreground uppercase flex-shrink-0">{r.kind}</span>
                </div>
              ))}
            </div>}
      </div>
    </div>
  );
}
