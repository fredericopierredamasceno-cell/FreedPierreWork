import { Plus } from "lucide-react";
import type { CMSRelease } from "../lib/types";
import { FadeIn } from "./FadeIn";
import { SectionLabel } from "./SectionLabel";
import { ReleaseCard } from "./ReleaseCard";

/**
 * Seção "Ouça nas plataformas" — divulga lançamentos oficiais já disponíveis
 * em serviços de streaming (Spotify, Apple Music, Deezer, YouTube Music).
 * Independente do player de prévias (AudioCarousel/CMSAudio): fica logo
 * abaixo dele na página, mas não compartilha estado nem dados com ele.
 */
export function ReleasesSection({ releases, showAdmin, onAdd, onEdit, onToggleHide, onDelete, texts }: {
  releases: CMSRelease[];
  showAdmin: boolean;
  onAdd?: () => void;
  onEdit?: (r: CMSRelease) => void;
  onToggleHide?: (id: string) => void;
  onDelete?: (id: string) => void;
  texts: {
    subheading: string; titleLine1: string; titleLine2: string;
    ctaNew: string; ctaFirst: string; empty: string;
  };
}) {
  const visible = showAdmin ? releases : releases.filter(r => !r.hidden);
  if (visible.length === 0 && !showAdmin) return null;

  return (
    <section id="plataformas" className="py-16 md:py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-5 md:px-6">
        <FadeIn><SectionLabel>{texts.subheading}</SectionLabel></FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 md:mb-12">
          <FadeIn delay={60}>
            <h2 className="text-4xl md:text-7xl font-black uppercase text-foreground leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {texts.titleLine1}<br /><span className="text-primary">{texts.titleLine2}</span>
            </h2>
          </FadeIn>
          {showAdmin && onAdd && (
            <FadeIn delay={100}>
              <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2.5 font-bold text-xs tracking-widest uppercase bg-primary text-background self-start sm:self-auto">
                <Plus size={13} />{texts.ctaNew}
              </button>
            </FadeIn>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="border border-dashed border-border py-16 flex flex-col items-center gap-3">
            <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase text-center">{texts.empty}</p>
            {showAdmin && onAdd && (
              <button onClick={onAdd} className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 font-bold text-xs tracking-widest uppercase mt-1">
                <Plus size={12} />{texts.ctaFirst}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
            {visible.map((r, i) => (
              <FadeIn key={r.id} delay={Math.min(i, 8) * 40}>
                <ReleaseCard release={r} showAdmin={showAdmin} onEdit={onEdit} onToggleHide={onToggleHide} onDelete={onDelete} />
              </FadeIn>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
