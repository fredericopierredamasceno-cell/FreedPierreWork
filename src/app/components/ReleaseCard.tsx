import { Music, Trash2 } from "lucide-react";
import type { CMSRelease } from "../lib/types";
import { releaseLinks } from "../lib/platformIcons";
import { VisibilityToggleButton, VisibilityBadge } from "./edit/VisibilityToggleButton";

export function ReleaseCard({ release, showAdmin, onEdit, onToggleHide, onDelete }: {
  release: CMSRelease; showAdmin?: boolean;
  onEdit?: (r: CMSRelease) => void;
  onToggleHide?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const links = releaseLinks(release);

  return (
    <div className={`group relative border overflow-hidden bg-card/30 transition-colors ${release.hidden ? "border-border/30 opacity-50" : "border-border hover:border-primary/40"}`}>
      <div
        className={`aspect-square relative overflow-hidden bg-muted ${showAdmin && onEdit ? "cursor-pointer" : ""}`}
        onClick={() => showAdmin && onEdit?.(release)}
      >
        {release.coverUrl
          ? <img src={release.coverUrl} alt={release.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1A1E2B 0%, #0F111A 100%)" }}>
              <Music size={28} className="text-muted-foreground/40" />
            </div>}
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/0 to-transparent pointer-events-none" />
      </div>

      <div className="p-3 md:p-4">
        <h3 className="text-sm md:text-base font-black uppercase text-foreground leading-tight truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }} title={release.title}>
          {release.title}
        </h3>
        <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">{release.artist}</p>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {links.map(({ meta, url }) => (
            <a
              key={meta.key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={meta.label}
              onClick={e => e.stopPropagation()}
              className="w-8 h-8 flex items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <meta.Icon size={14} />
            </a>
          ))}
        </div>

        {showAdmin && <div className="mt-2"><VisibilityBadge hidden={!!release.hidden} /></div>}
      </div>

      {showAdmin && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {onEdit && (
            <button onClick={() => onEdit(release)} title="Editar" className="bg-background/80 font-mono text-[9px] px-2 py-1 border border-border text-muted-foreground hover:border-primary hover:text-primary">✏</button>
          )}
          {onToggleHide && <span className="bg-background/80"><VisibilityToggleButton hidden={!!release.hidden} onToggle={() => onToggleHide(release.id)} size={9} /></span>}
          {onDelete && (
            <button onClick={() => onDelete(release.id)} title="Deletar permanentemente" className="bg-background/80 font-mono text-[9px] px-2 py-1 border border-red-500/40 text-red-400"><Trash2 size={9} /></button>
          )}
        </div>
      )}
    </div>
  );
}
