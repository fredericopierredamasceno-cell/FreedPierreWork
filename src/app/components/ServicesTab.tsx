import { useState } from "react";
import { Plus, X, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, AlertTriangle } from "lucide-react";
import type { CMSData, CMSServiceContent, CMSAdvantageContent } from "../lib/types";
import { DESIGN_SERVICE_ID } from "../lib/defaults";
import {
  createService, moveService, renameService, projectsOfService, serviceColor, reindexServices,
} from "../lib/services";
import { SERVICE_ICON_KEYS, ServiceIcon } from "../lib/serviceIcons";
import { TextField } from "./ui-admin/Field";

/* ═══════════════════════════════════════════════════════════════════
   Aba "Serviços" do Admin — fonte de verdade das categorias principais.

   Tudo aqui grava direto em cms.services (mesmo CMS, mesmo fluxo de
   salvar/publicar). Criar um serviço novo NÃO exige tocar em código:
   ele aparece no site, no seletor de upload, na edição de projetos e
   na galeria automaticamente.
═══════════════════════════════════════════════════════════════════ */

type DeleteTarget = { service: CMSServiceContent; count: number };

export function ServicesTab({ cms, setCms }: { cms: CMSData; setCms: (d: CMSData) => void }) {
  const [newDesignCat, setNewDesignCat] = useState("");
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string>("");

  const services = cms.services;

  const setServices = (list: CMSServiceContent[], projects = cms.projects) =>
    setCms({ ...cms, services: list, projects });

  const updService = (id: string, patch: Partial<CMSServiceContent>) =>
    setServices(services.map(s => (s.id === id ? { ...s, ...patch } : s)));

  // Renomear preserva o ID; os projetos do serviço só têm o rótulo legado
  // `category` atualizado — nenhum projeto troca de serviço.
  const handleRename = (id: string, title: string) => {
    const next = renameService(services, cms.projects, id, title);
    setServices(next.services, next.projects);
  };

  // O nome é pedido ANTES de criar porque o ID é derivado dele e nunca muda
  // depois — criar como "Novo serviço" deixaria o ID `novo-servico` para sempre.
  const handleAdd = () => {
    const title = (prompt("Nome do novo serviço (ex: Fotografia, Direção de Arte):") ?? "").trim();
    if (!title) return;
    const created = createService(services, { title, description: "", tags: [], icon: "sparkles" });
    setServices([...services, created]);
    setIconPickerFor(created.id);
  };

  const handleMove = (id: string, dir: -1 | 1) => setServices(moveService(services, id, dir));

  const handleToggleActive = (s: CMSServiceContent) => updService(s.id, { active: !s.active });

  const askDelete = (s: CMSServiceContent) => {
    const count = projectsOfService(cms.projects, s).length;
    if (count === 0) {
      if (!confirm(`Excluir o serviço "${s.title}"? Ele não possui projetos associados.`)) return;
      setServices(reindexServices(services.filter(x => x.id !== s.id)));
      return;
    }
    setMoveTargetId(services.find(x => x.id !== s.id)?.id ?? "");
    setDeleting({ service: s, count });
  };

  /** Exclui o serviço SEM nunca apagar projetos: eles são movidos para
   *  outro serviço ou simplesmente ficam sem serviço (agrupados em
   *  "Outros projetos" no site, e reatribuíveis pela edição do projeto). */
  const confirmDelete = (mode: "move" | "detach") => {
    if (!deleting) return;
    const { service } = deleting;
    const target = mode === "move" ? services.find(s => s.id === moveTargetId) ?? null : null;
    if (mode === "move" && !target) return;

    const affected = new Set(projectsOfService(cms.projects, service).map(p => p.id));
    const projects = cms.projects.map(p => {
      if (!affected.has(p.id)) return p;
      return target
        ? { ...p, serviceId: target.id, category: target.title, updatedAt: Date.now() }
        : { ...p, serviceId: undefined, updatedAt: Date.now() };
    });

    setServices(reindexServices(services.filter(s => s.id !== service.id)), projects);
    setDeleting(null);
  };

  const updAdvantage = (i: number, k: keyof CMSAdvantageContent, v: string) =>
    setCms({ ...cms, advantages: cms.advantages.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)) });

  const addDesignCategory = () => {
    const name = newDesignCat.trim();
    if (!name || cms.designCategories.includes(name)) { setNewDesignCat(""); return; }
    setCms({ ...cms, designCategories: [...cms.designCategories, name] });
    setNewDesignCat("");
  };

  const removeDesignCategory = (name: string) => {
    if (!confirm(`Remover a categoria "${name}"? Projetos nela ficarão sem subcategoria (não são apagados).`)) return;
    setCms({
      ...cms,
      designCategories: cms.designCategories.filter(c => c !== name),
      projects: cms.projects.map(p => (p.subcategory === name ? { ...p, subcategory: undefined } : p)),
    });
  };

  const designService = services.find(s => s.id === DESIGN_SERVICE_ID);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] text-muted-foreground">Os serviços do site vêm daqui. Publique para salvar.</p>
        <button onClick={handleAdd} className="flex items-center gap-1.5 px-3 py-2 font-bold text-[10px] tracking-widest uppercase bg-primary text-background flex-shrink-0 transition-transform duration-150 hover:brightness-110 active:scale-95">
          <Plus size={11} />Novo serviço
        </button>
      </div>

      {services.length === 0 && (
        <div className="border border-dashed border-border py-10 text-center">
          <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Nenhum serviço — crie o primeiro acima.</p>
        </div>
      )}

      {services.map((s, i) => (
        <div key={s.id} className={`border p-4 space-y-3 ${s.active ? "border-border" : "border-border/40 bg-muted/20"}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-4 flex-shrink-0" style={{ background: serviceColor(s) }} />
            <span className="font-mono text-[10px] text-primary uppercase tracking-widest">
              Serviço {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground/60 truncate">id: {s.id}</span>
            <span className="font-mono text-[9px] text-muted-foreground/60">· {projectsOfService(cms.projects, s).length} projeto(s)</span>
            {!s.active && <span className="font-mono text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground uppercase">Inativo</span>}

            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => handleMove(s.id, -1)} disabled={i === 0} title="Subir" className="w-7 h-7 flex items-center justify-center border border-border text-muted-foreground disabled:opacity-25 hover:border-primary hover:text-primary transition-colors"><ChevronUp size={12} /></button>
              <button onClick={() => handleMove(s.id, 1)} disabled={i === services.length - 1} title="Descer" className="w-7 h-7 flex items-center justify-center border border-border text-muted-foreground disabled:opacity-25 hover:border-primary hover:text-primary transition-colors"><ChevronDown size={12} /></button>
              <button onClick={() => handleToggleActive(s)} title={s.active ? "Desativar (some do site)" : "Reativar"} className={`w-7 h-7 flex items-center justify-center border transition-colors ${s.active ? "border-border text-muted-foreground hover:border-primary hover:text-primary" : "border-green-500/40 text-green-400"}`}>
                {s.active ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button onClick={() => askDelete(s)} title="Excluir serviço" className="w-7 h-7 flex items-center justify-center border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-colors"><Trash2 size={12} /></button>
            </div>
          </div>

          <TextField label="Nome" value={s.title} onChange={v => handleRename(s.id, v)} required />
          <TextField label="Descrição" value={s.description} onChange={v => updService(s.id, { description: v })} multiline rows={3} required />
          <TextField
            label="Tags (separadas por vírgula)"
            value={s.tags.join(", ")}
            onChange={v => updService(s.id, { tags: v.split(",").map(t => t.trim()).filter(Boolean) })}
            hint="Ex: Photoshop, Identidade Visual"
          />

          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Ícone</label>
            <button onClick={() => setIconPickerFor(iconPickerFor === s.id ? null : s.id)} className="flex items-center gap-2 border border-border px-3 py-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <ServiceIcon name={s.icon} size={16} />
              <span className="font-mono text-[10px] uppercase tracking-widest">{s.icon}</span>
            </button>
            {iconPickerFor === s.id && (
              <div className="mt-2 border border-border p-2 grid grid-cols-8 gap-1 max-h-44 overflow-y-auto">
                {SERVICE_ICON_KEYS.map(key => (
                  <button
                    key={key} title={key}
                    onClick={() => { updService(s.id, { icon: key }); setIconPickerFor(null); }}
                    className={`aspect-square flex items-center justify-center border transition-colors ${s.icon === key ? "border-primary text-primary" : "border-border/50 text-muted-foreground hover:border-primary hover:text-primary"}`}
                  >
                    <ServiceIcon name={key} size={15} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Subcategorias continuam sendo um conceito separado de serviço. */}
      <div className="border-t border-border pt-4">
        <div className="font-mono text-[10px] text-primary uppercase tracking-widest mb-1">Subcategorias — {designService?.title ?? "Design Gráfico"}</div>
        <p className="font-mono text-[9px] text-muted-foreground mb-3">Subcategoria não é serviço: elas vivem dentro do portfólio de design e aparecem no upload, na edição de projetos e na navegação da galeria.</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {cms.designCategories.map(c => (
            <span key={c} className="flex items-center gap-1.5 font-mono text-[9px] tracking-wider uppercase pl-2.5 pr-1.5 py-1.5 border border-border text-muted-foreground">
              {c}
              <button onClick={() => removeDesignCategory(c)} title="Remover" className="w-4 h-4 flex items-center justify-center text-red-400 hover:text-red-300"><X size={9} /></button>
            </span>
          ))}
          {cms.designCategories.length === 0 && <span className="font-mono text-[9px] text-muted-foreground/60">Nenhuma subcategoria ainda.</span>}
        </div>
        <div className="flex gap-2">
          <input value={newDesignCat} onChange={e => setNewDesignCat(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDesignCategory(); } }} placeholder="Nova subcategoria (ex: Cardápios)" className="flex-1 bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
          <button onClick={addDesignCategory} className="flex items-center gap-1.5 px-3 py-2 font-bold text-[10px] tracking-widest uppercase bg-primary text-background"><Plus size={11} />Adicionar</button>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="font-mono text-[10px] text-primary uppercase tracking-widest mb-3">Vantagens — "Por que eu?"</div>
        {cms.advantages.map((a, i) => (
          <div key={i} className="border border-border p-4 space-y-2 mb-2">
            <div className="font-mono text-[10px] text-muted-foreground uppercase">Vantagem {i + 1}</div>
            <TextField label="Título" value={a.title} onChange={v => updAdvantage(i, "title", v)} required />
            <TextField label="Texto" value={a.body} onChange={v => updAdvantage(i, "body", v)} multiline rows={2} required />
          </div>
        ))}
      </div>

      {deleting && (
        <ServiceDeleteDialog
          service={deleting.service}
          count={deleting.count}
          services={services}
          moveTargetId={moveTargetId}
          setMoveTargetId={setMoveTargetId}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

/** Exclusão segura: nenhum projeto é apagado junto com o serviço. */
function ServiceDeleteDialog({ service, count, services, moveTargetId, setMoveTargetId, onCancel, onConfirm }: {
  service: CMSServiceContent; count: number; services: CMSServiceContent[];
  moveTargetId: string; setMoveTargetId: (id: string) => void;
  onCancel: () => void; onConfirm: (mode: "move" | "detach") => void;
}) {
  const others = services.filter(s => s.id !== service.id);

  return (
    <div className="fixed inset-0 z-[420] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <AlertTriangle size={14} className="text-amber-400" />
          <span className="font-mono text-[10px] text-amber-400 tracking-widest uppercase">Excluir serviço</span>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-foreground font-light">
            Este serviço possui <strong>{count} projeto{count !== 1 ? "s" : ""}</strong> associado{count !== 1 ? "s" : ""}.
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">Os projetos NÃO serão apagados. Escolha o que fazer com eles:</p>

          <div className="space-y-2">
            {others.length > 0 && (
              <div className="border border-border p-3 space-y-2">
                <div className="font-mono text-[10px] text-foreground uppercase tracking-widest">Mover para outro serviço</div>
                <select value={moveTargetId} onChange={e => setMoveTargetId(e.target.value)} className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
                  {others.map(s => <option key={s.id} value={s.id}>{s.title}{!s.active ? " (inativo)" : ""}</option>)}
                </select>
                <button onClick={() => onConfirm("move")} disabled={!moveTargetId} className="w-full bg-primary text-background px-4 py-2 font-bold text-[10px] tracking-widest uppercase disabled:opacity-50">
                  Mover e excluir serviço
                </button>
              </div>
            )}

            <div className="border border-border p-3 space-y-2">
              <div className="font-mono text-[10px] text-foreground uppercase tracking-widest">Deixar sem serviço</div>
              <p className="font-mono text-[9px] text-muted-foreground">Os projetos continuam salvos e aparecem agrupados em "Outros projetos". Dá para reatribuir depois na edição de cada projeto.</p>
              <button onClick={() => onConfirm("detach")} className="w-full border border-red-500/40 text-red-400 px-4 py-2 font-bold text-[10px] tracking-widest uppercase hover:bg-red-500 hover:text-white transition-colors">
                Excluir serviço e manter projetos
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3 flex justify-end">
          <button onClick={onCancel} className="font-mono text-xs text-muted-foreground uppercase tracking-widest px-3 py-2">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
