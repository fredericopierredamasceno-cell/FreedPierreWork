import { useState, useEffect } from "react";
import type { CMSAudio, UploadProgress } from "../lib/types";
import { AUDIO_GENRES } from "../lib/defaults";
import { EditModalShell } from "./edit/EditModalShell";
import { MediaReplaceField } from "./edit/MediaReplaceField";

export function EditAudioModal({ audio, open, onClose, onSave, uploadFile, ghConfigured }: {
  audio: CMSAudio | null; open: boolean; onClose: () => void;
  onSave: (updated: CMSAudio) => Promise<void>;
  uploadFile: (f: File, t: "image" | "video" | "audio", onProgress: (p: UploadProgress) => void) => Promise<string | null>;
  ghConfigured: boolean;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (audio) { setTitle(audio.title); setArtist(audio.artist ?? ""); setGenre(audio.genre ?? ""); }
    setCoverFile(null); setProgress(null); setBusy(false); setDone(false);
  }, [audio, open]);

  if (!open || !audio) return null;

  const handleSave = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    let coverUrl = audio.coverUrl;
    if (coverFile && ghConfigured) {
      const u = await uploadFile(coverFile, "image", setProgress);
      if (u) coverUrl = u;
    }
    await onSave({ ...audio, title: title.trim(), artist: artist.trim() || undefined, genre: genre.trim() || undefined, coverUrl });
    setDone(true);
    setTimeout(() => { setDone(false); onClose(); }, 600);
    setBusy(false);
  };

  return (
    <EditModalShell eyebrow="Editar Áudio" title="Metadados" onClose={onClose} canSave={!!title.trim()} busy={busy} done={done} onSave={handleSave}>
      <MediaReplaceField
        label="Trocar capa"
        previewUrl={audio.coverUrl}
        previewKind="audio-cover"
        inputId="edit-cover-inp"
        accept="image/*"
        file={coverFile}
        onFileChange={setCoverFile}
        progress={progress}
        compact
      />
      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Título *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
      </div>
      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Artista / feat.</label>
        <input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Frederico Pierre" className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
      </div>
      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Gênero</label>
        <div className="flex flex-wrap gap-1.5">
          {AUDIO_GENRES.map(g => (
            <button key={g} type="button" onClick={() => setGenre(genre === g ? "" : g)} className={`font-mono text-[9px] tracking-wider uppercase px-2 py-1 border transition-colors ${genre === g ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>{g}</button>
          ))}
        </div>
      </div>
    </EditModalShell>
  );
}
