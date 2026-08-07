import { useState } from "react";
import { Search, Youtube, Trash2, Music, Library } from "lucide-react";
import type { CMSData, CMSProject, CMSAudio } from "../lib/types";
import { VisibilityToggleButton, VisibilityBadge } from "./edit/VisibilityToggleButton";

export function MediaLibraryTab({
  cms, onDeleteProject, onDeleteAudio, onEditProject, onEditAudio, onToggleHideProject, onToggleHideAudio,
}: {
  cms: CMSData;
  onDeleteProject: (id: string) => void; onDeleteAudio: (id: string) => void;
  onEditProject: (p: CMSProject) => void; onEditAudio: (a: CMSAudio) => void;
  onToggleHideProject: (id: string) => void; onToggleHideAudio: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "video" | "image" | "embed" | "audio">("all");

  const projectItems = cms.projects.filter(p =>
    (filterType === "all" || p.mediaType === filterType) &&
    (!search || p.title.toLowerCase().includes(search.toLowerCase()))
  );
  const audioItems = cms.audios.filter(a =>
    (filterType === "all" || filterType === "audio") &&
    (!search || a.title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full bg-muted border border-border pl-8 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "video", "image", "audio", "embed"] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`font-mono text-[9px] tracking-widest uppercase px-2 py-1.5 border transition-colors ${filterType === t ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
              {t === "all" ? "Todos" : t === "embed" ? "YT/VM" : t}
            </button>
          ))}
        </div>
      </div>
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{projectItems.length + (filterType === "all" || filterType === "audio" ? audioItems.length : 0)} itens</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {projectItems.map(p => (
          <div key={p.id} className={`relative border overflow-hidden group ${p.hidden ? "border-border/40 opacity-50" : "border-border"}`}>
            <div className="aspect-video bg-card cursor-pointer" onClick={() => onEditProject(p)}>
              {p.mediaType === "video" && <video src={p.mediaUrl} muted className="w-full h-full object-cover" />}
              {p.mediaType === "embed" && p.thumbUrl && <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />}
              {p.mediaType === "embed" && !p.thumbUrl && <div className="w-full h-full flex items-center justify-center"><Youtube size={16} className="text-red-400" /></div>}
              {p.mediaType === "image" && <img src={(p.images?.[0] ?? p.mediaUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />}
            </div>
            <div className="p-2">
              <p className="text-xs font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{p.title}</p>
              <div className="flex items-center justify-between mt-1 gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-[9px] text-muted-foreground uppercase truncate">{p.mediaType}{p.images && p.images.length > 1 ? ` ×${p.images.length}` : ""}</span>
                  <VisibilityBadge hidden={!!p.hidden} />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEditProject(p)} title="Editar" className="text-muted-foreground hover:text-primary font-mono text-[9px]">✏</button>
                  <VisibilityToggleButton hidden={!!p.hidden} onToggle={() => onToggleHideProject(p.id)} size={9} />
                  <button onClick={() => onDeleteProject(p.id)} className="text-red-400"><Trash2 size={10} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {(filterType === "all" || filterType === "audio") && audioItems.map(a => (
          <div key={a.id} className={`relative border overflow-hidden group ${a.hidden ? "border-border/40 opacity-50" : "border-border"}`}>
            <div className="aspect-video bg-card flex items-center justify-center cursor-pointer" onClick={() => onEditAudio(a)}>
              {a.coverUrl ? <img src={a.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music size={20} className="text-muted-foreground" />}
            </div>
            <div className="p-2">
              <p className="text-xs font-bold text-foreground truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{a.title}</p>
              <div className="flex items-center justify-between mt-1 gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-[9px] text-muted-foreground uppercase">áudio</span>
                  <VisibilityBadge hidden={!!a.hidden} />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEditAudio(a)} title="Editar" className="text-muted-foreground hover:text-primary font-mono text-[9px]">✏</button>
                  <VisibilityToggleButton hidden={!!a.hidden} onToggle={() => onToggleHideAudio(a.id)} size={9} />
                  <button onClick={() => onDeleteAudio(a.id)} className="text-red-400"><Trash2 size={10} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {projectItems.length === 0 && audioItems.length === 0 && (
        <div className="border border-dashed border-border py-10 text-center">
          <Library size={18} className="text-muted-foreground mx-auto mb-2" />
          <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Nenhuma mídia encontrada</p>
        </div>
      )}
    </div>
  );
}
