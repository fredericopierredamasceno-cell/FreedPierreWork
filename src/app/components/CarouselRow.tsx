import type { DisplayProject } from "../lib/types";
import { CATEGORY_COLORS } from "../lib/defaults";
import { useCarouselScroll } from "../hooks/useCarouselScroll";
import { ProjectCard } from "./ProjectCard";
export function CarouselRow({ label, items, showAdmin, pinned, onTogglePin, onDelete, onClickItem }: {
  label: string; items: DisplayProject[]; showAdmin: boolean; pinned: Set<string>;
  onTogglePin: (id: string) => void; onDelete: (id: string) => void; onClickItem: (item: DisplayProject) => void;
}) {
  const { scrollRef, canLeft, canRight, updateArrows, scroll, onWheel } = useCarouselScroll(items.length);
  const accent = CATEGORY_COLORS[label] ?? "var(--primary)";
  if (items.length === 0) return null;

  return (
    <div className="mb-8 md:mb-10">
      <div className="flex items-center justify-between mb-3 pr-1">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-5 flex-shrink-0 rounded-sm" style={{ background: accent }} />
          <span className="font-black uppercase text-foreground text-lg md:text-xl leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{label}</span>
          <span className="font-mono text-[9px] text-muted-foreground tracking-widest">{items.length}</span>
        </div>
        <div className="flex gap-1">
          {(["left", "right"] as const).map(dir => (
            <button key={dir} onClick={() => scroll(dir)} disabled={dir === "left" ? !canLeft : !canRight}
              className={`w-7 h-7 border flex items-center justify-center text-xs font-bold transition-all ${(dir === "left" ? canLeft : canRight) ? "border-border text-muted-foreground hover:border-primary hover:text-primary" : "border-border/30 text-muted-foreground/20 cursor-not-allowed"}`}>
              {dir === "left" ? "‹" : "›"}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-2 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className={`absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity ${canRight ? "opacity-100" : "opacity-0"}`} />
        <div
          ref={scrollRef} onScroll={updateArrows} onWheel={onWheel}
          className="flex gap-2 md:gap-3 overflow-x-auto pb-2"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-x" }}
        >
          {items.map((item, idx) => (
            <div key={item.id} data-card className="flex-shrink-0" style={{ scrollSnapAlign: "start", width: idx === 0 && items.length > 1 ? "clamp(220px, 38vw, 320px)" : "clamp(180px, 30vw, 260px)" }}>
              <ProjectCard item={item} showAdmin={showAdmin} isPinned={pinned.has(item.id)} onTogglePin={onTogglePin} onDelete={!item.isFixed ? onDelete : undefined} onClick={() => onClickItem(item)} />
            </div>
          ))}
          <div className="flex-shrink-0 w-4" />
        </div>
      </div>
    </div>
  );
}
