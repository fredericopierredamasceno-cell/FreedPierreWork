import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import type { CMSRelease, UploadProgress } from "../lib/types";
import { PLATFORM_META } from "../lib/platformIcons";
import { EditModalShell } from "./edit/EditModalShell";
import { MediaReplaceField } from "./edit/MediaReplaceField";
import { VisibilityToggleButton } from "./edit/VisibilityToggleButton";

/**
 * Cria ou edita um lançamento da seção "Ouça nas plataformas".
 * `release === null` → modo criação (formulário em branco).
 * `release !== null` → modo edição (pré-preenchido, capa atual mantida se não trocada).
 * Segue o mesmo padrão do EditAudioModal/EditProjectModal (EditModalShell +
 * MediaReplaceField) para manter a experiência de admin consistente.
 */
export function ReleaseFormModal({ release, open, onClose, onSave, onToggleHidden, uploadFile, ghConfigured }: {
  release: CMSRelease | null; open: boolean; onClose: () => void;
  onSave: (release: CMSRelease) => Promise<void>;
  onToggleHidden?: (id: string) => void;
  uploadFile: (f: File, t: "image" | "video" | "audio", onProgress: (p: UploadProgress) => void) => Promise<string | null>;
  ghConfigured: boolean;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    const nextLinks: Record<string, string> = {};
    for (const m of PLATFORM_META) nextLinks[m.field] = (release?.[m.field] ?? "") as string;
    if (release) { setTitle(release.title); setArtist(release.artist); }
    else { setTitle(""); setArtist(""); }
    setLinks(nextLinks);
    setCoverFile(null); setProgress(null); setBusy(false); setDone(false); setErrMsg("");
  }, [release, open]);

  if (!open) return null;

  const spotifyUrl = links.spotifyUrl ?? "";
  const canSave = !!title.trim() && !!artist.trim() && !!spotifyUrl.trim() && (!!release?.coverUrl || !!coverFile) && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true); setErrMsg("");
    let coverUrl = release?.coverUrl;
    if (coverFile) {
      if (!ghConfigured) { setErrMsg("Configure o GitHub antes de enviar a capa."); setBusy(false); return; }
      const u = await uploadFile(coverFile, "image", setProgress);
      if (!u) { setErrMsg("Falha no upload da capa."); setBusy(false); return; }
      coverUrl = u;
    }
    if (!coverUrl) { setErrMsg("Adicione uma capa para o lançamento."); setBusy(false); return; }

    const payload: CMSRelease = {
      id: release?.id ?? `release-${Date.now()}`,
      title: title.trim(), artist: artist.trim(), coverUrl,
      spotifyUrl: spotifyUrl.trim(),
      appleMusicUrl: links.appleMusicUrl?.trim() || undefined,
      deezerUrl: links.deezerUrl?.trim() || undefined,
      youtubeMusicUrl: links.youtubeMusicUrl?.trim() || undefined,
      createdAt: release?.createdAt ?? Date.now(),
      hidden: release?.hidden,
    };
    await onSave(payload);
    setDone(true);
    setTimeout(() => { setDone(false); onClose(); }, 600);
    setBusy(false);
  };

  return (
    <EditModalShell
      eyebrow={release ? "Editar Lançamento" : "Novo Lançamento"}
      title="Plataformas"
      onClose={onClose}
      canSave={canSave}
      busy={busy}
      done={done}
      onSave={handleSave}
      extraHeaderAction={release && onToggleHidden ? <VisibilityToggleButton hidden={!!release.hidden} onToggle={() => onToggleHidden(release.id)} size={11} /> : undefined}
    >
      {!ghConfigured && (
        <div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/80 font-light">Configure o GitHub antes de fazer uploads.</p>
        </div>
      )}

      <MediaReplaceField
        label="Capa *"
        previewUrl={release?.coverUrl}
        previewKind="image"
        inputId="release-cover-inp"
        accept="image/*"
        file={coverFile}
        onFileChange={setCoverFile}
        progress={progress}
        compact
      />

      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Título *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome da música / EP / álbum" className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
      </div>
      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Artista *</label>
        <input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Frederico Pierre" className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
      </div>

      <div className="pt-1 border-t border-border" />
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Links das plataformas</p>
      {PLATFORM_META.map(m => (
        <div key={m.key}>
          <label className="font-mono text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 mb-1.5">
            <m.Icon size={11} />{m.label} {m.required ? "*" : <span className="normal-case text-muted-foreground/60">(opcional)</span>}
          </label>
          <input
            value={links[m.field] ?? ""}
            onChange={e => setLinks(prev => ({ ...prev, [m.field]: e.target.value }))}
            placeholder={`https://...`}
            className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
          />
        </div>
      ))}

      {errMsg && (
        <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/5 px-3 py-3">
          <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300 font-light">{errMsg}</span>
        </div>
      )}
    </EditModalShell>
  );
}
