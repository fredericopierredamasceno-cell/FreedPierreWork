import { useRef, useState } from "react";
import { GripVertical, Star, Trash2, RefreshCw, Plus, AlertCircle, Loader2, CheckCircle2, ImageIcon } from "lucide-react";
import type { GalleryDraftItem } from "../lib/gallery";
export type { GalleryDraftItem };

export function GalleryManager({
  items, onChange, disabled, addLabel = "Adicionar imagens",
}: {
  items: GalleryDraftItem[];
  onChange: (items: GalleryDraftItem[]) => void;
  disabled?: boolean;
  addLabel?: string;
}) {
  const inputId = useRef(`gallery-inp-${Math.random().toString(36).slice(2, 9)}`).current;
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const addFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const added: GalleryDraftItem[] = Array.from(files).map(file => ({
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file, previewUrl: URL.createObjectURL(file),
      isMain: items.length === 0,
      status: "pending",
    }));
    onChange([...items, ...added]);
  };

  const remove = (id: string) => {
    const wasMain = items.find(i => i.id === id)?.isMain;
    const next = items.filter(i => i.id !== id);
    if (wasMain && next.length) next[0] = { ...next[0], isMain: true };
    onChange(next);
  };

  const setMain = (id: string) => onChange(items.map(i => ({ ...i, isMain: i.id === id })));

  const replace = (id: string, file: File) => onChange(items.map(i => i.id === id
    ? { ...i, file, previewUrl: URL.createObjectURL(file), finalUrl: undefined, status: "pending" as const, error: undefined }
    : i));

  const retry = (id: string) => onChange(items.map(i => i.id === id ? { ...i, status: "pending" as const, error: undefined } : i));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const arr = [...items];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChange(arr);
  };

  return (
    <div>
      {items.length > 0 && (
        <ul className="space-y-1.5 mb-2.5">
          {items.map((it, i) => (
            <li
              key={it.id}
              draggable={!disabled}
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
              onDragEnd={() => setDragIdx(null)}
              className={`flex items-center gap-2 bg-muted border px-2.5 py-2 transition-colors ${dragIdx === i ? "border-primary" : "border-border"}`}
            >
              <GripVertical size={13} className="text-muted-foreground/50 flex-shrink-0 cursor-grab" />
              <div className="w-10 h-10 flex-shrink-0 border border-border overflow-hidden bg-background relative">
                <img src={it.previewUrl} alt="" className="w-full h-full object-cover" />
                {it.status === "uploading" && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center"><Loader2 size={12} className="animate-spin text-primary" /></div>
                )}
                {it.status === "error" && (
                  <div className="absolute inset-0 bg-red-950/70 flex items-center justify-center"><AlertCircle size={12} className="text-red-300" /></div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-foreground truncate">{it.file ? it.file.name : `Imagem ${i + 1}`}</span>
                  {it.isMain && <span className="flex-shrink-0 font-mono text-[8px] tracking-wider uppercase text-primary border border-primary/40 px-1 py-0.5">Capa</span>}
                </div>
                <div className="font-mono text-[9px] tracking-wider uppercase mt-0.5 flex items-center gap-1">
                  {it.status === "existing" && <span className="text-muted-foreground/70 flex items-center gap-1"><CheckCircle2 size={9} className="text-green-500" />Publicada</span>}
                  {it.status === "pending" && <span className="text-muted-foreground/70">Aguardando envio</span>}
                  {it.status === "uploading" && <span className="text-primary flex items-center gap-1"><Loader2 size={9} className="animate-spin" />Enviando{it.progress ? ` — ${Math.round(it.progress.percent)}%` : "..."}</span>}
                  {it.status === "done" && <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={9} />Enviada</span>}
                  {it.status === "error" && <span className="text-red-400 flex items-center gap-1"><AlertCircle size={9} />{it.error || "Falhou"}</span>}
                </div>
                {it.status === "uploading" && it.progress && (
                  <div className="w-full h-1 bg-background rounded-full overflow-hidden mt-1"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${it.progress.percent}%` }} /></div>
                )}
              </div>

              <div className="flex items-center gap-0.5 flex-shrink-0">
                {!it.isMain && (
                  <button type="button" title="Definir como capa" disabled={disabled} onClick={() => setMain(it.id)} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-30"><Star size={12} /></button>
                )}
                {it.status === "error" ? (
                  <button type="button" title="Tentar novamente" disabled={disabled} onClick={() => retry(it.id)} className="w-7 h-7 flex items-center justify-center text-amber-400 hover:text-amber-300 disabled:opacity-30"><RefreshCw size={12} /></button>
                ) : (
                  <>
                    <input id={`${inputId}-replace-${it.id}`} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) replace(it.id, f); e.target.value = ""; }} />
                    <button type="button" title="Substituir imagem" disabled={disabled} onClick={() => document.getElementById(`${inputId}-replace-${it.id}`)?.click()} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-30"><RefreshCw size={12} /></button>
                  </>
                )}
                <button type="button" title="Remover" disabled={disabled} onClick={() => remove(it.id)} className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-300 disabled:opacity-30"><Trash2 size={12} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={`border-2 border-dashed p-4 text-center transition-colors ${disabled ? "border-border opacity-50 cursor-not-allowed" : "border-border hover:border-primary/40 cursor-pointer"}`} onClick={() => !disabled && document.getElementById(inputId)?.click()}>
        <input id={inputId} type="file" accept="image/*" multiple className="hidden" disabled={disabled} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          {items.length === 0 ? <ImageIcon size={14} /> : <Plus size={14} />}
          <span className="text-xs font-mono tracking-wider uppercase">{items.length === 0 ? "Selecionar imagem(ns)" : addLabel}</span>
        </div>
      </div>
      {items.length > 1 && <p className="font-mono text-[9px] text-muted-foreground/60 mt-1.5">Arraste pelo ⠿ para reordenar. A ⭐ marca a capa do projeto. {items.length} imagens no carrossel.</p>}
    </div>
  );
}
