import { useState, useEffect } from "react";
import { X, Music, Check, Loader2 } from "lucide-react";
import type { CMSAudio, UploadProgress } from "../lib/types";
import { AUDIO_GENRES } from "../lib/defaults";
import { UploadProgressBar } from "./UploadProgressBar";
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
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">Editar Áudio</div>
            <h2 className="text-xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Metadados</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 border border-border flex items-center justify-center text-muted-foreground"><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Current cover preview */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 border border-border flex-shrink-0 overflow-hidden">
              {audio.coverUrl ? <img src={audio.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Music size={20} className="text-muted-foreground" /></div>}
            </div>
            <div className="flex-1">
              <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Trocar capa</label>
              <div className={`border border-dashed p-2.5 text-center cursor-pointer transition-colors ${coverFile ? "border-primary" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("edit-cover-inp")?.click()}>
                <input id="edit-cover-inp" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setCoverFile(f); e.target.value = ""; }} />
                <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase">{coverFile ? coverFile.name.slice(0, 20) : "Selecionar imagem"}</span>
              </div>
              {progress && <div className="mt-1.5"><UploadProgressBar progress={progress} /></div>}
            </div>
          </div>
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
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="font-mono text-xs text-muted-foreground tracking-widest uppercase">Cancelar</button>
          <button onClick={handleSave} disabled={!title.trim() || busy} className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs tracking-widest uppercase transition-all ${done ? "bg-green-600 text-white" : "bg-primary text-background disabled:opacity-50"}`}>
            {done ? <><Check size={12} />Salvo!</> : busy ? <><Loader2 size={12} className="animate-spin" />Salvando...</> : <><Check size={12} />Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
