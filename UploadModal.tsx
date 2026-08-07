import { useState, useEffect, useCallback } from "react";
import {
  X, Upload, Youtube, Link2, VideoIcon, ImageIcon, Music,
  AlertCircle, CheckCircle2, Check, Loader2, GripVertical, ChevronUp, ChevronDown, Trash2,
} from "lucide-react";
import type { CMSProject, CMSAudio, UploadProgress } from "../lib/types";
import { CATEGORIES, AUDIO_ACCEPT, AUDIO_GENRES } from "../lib/defaults";
import { MAX_FILE_BYTES } from "../lib/github";
import { MAX_VIDEO_DIMENSION, parseVideoUrl, probeVideoDimensions } from "../lib/video";
import { UploadProgressBar } from "./UploadProgressBar";
export type UploadMode = "file" | "youtube" | "vimeo";
export type UploadMediaType = "video" | "image" | "audio";

export function UploadModal({ open, onClose, onSave, onSaveAudio, uploadFile, ghConfigured }: {
  open: boolean; onClose: () => void;
  onSave: (proj: CMSProject) => Promise<void>;
  onSaveAudio: (audio: CMSAudio) => Promise<void>;
  uploadFile: (f: File, t: "image" | "video" | "audio", onProgress: (p: UploadProgress) => void) => Promise<string | null>;
  ghConfigured: boolean;
}) {
  const [tab, setTab] = useState<UploadMediaType>("video");
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [cat, setCat] = useState(CATEGORIES[0]);
  const [mode, setMode] = useState<UploadMode>("file");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [isCarousel, setIsCarousel] = useState(false);
  const [extraImageFiles, setExtraImageFiles] = useState<File[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioCoverFile, setAudioCoverFile] = useState<File | null>(null);
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [parsedVideo, setParsedVideo] = useState<ReturnType<typeof parseVideoUrl>>(null);
  const [thumbImgOk, setThumbImgOk] = useState(true);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [progress2, setProgress2] = useState<UploadProgress | null>(null);
  const [oversize, setOversize] = useState(false);
  const [incompatibleRes, setIncompatibleRes] = useState<{ width: number; height: number } | null>(null);
  const [checkingVideo, setCheckingVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const reset = useCallback(() => {
    setTitle(""); setDesc(""); setCat(CATEGORIES[0]); setMode("file");
    setMediaFile(null); setThumbFile(null); setIsCarousel(false); setExtraImageFiles([]); setAudioFile(null); setAudioCoverFile(null);
    setArtist(""); setGenre(""); setVideoUrl(""); setParsedVideo(null); setThumbImgOk(true);
    setProgress(null); setProgress2(null); setOversize(false); setIncompatibleRes(null); setCheckingVideo(false); setBusy(false); setDone(false); setErrMsg("");
  }, []);

  useEffect(() => {
    if (!open) { reset(); return; }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open, reset]);

  useEffect(() => {
    if (!videoUrl.trim()) { setParsedVideo(null); setThumbImgOk(true); return; }
    setParsedVideo(parseVideoUrl(videoUrl.trim())); setThumbImgOk(true);
  }, [videoUrl]);

  const handleFileChange = async (f: File) => {
    setIncompatibleRes(null);
    if (f.type.startsWith("video") && f.size > MAX_FILE_BYTES) { setOversize(true); setMediaFile(null); return; }
    setOversize(false);
    if (f.type.startsWith("video")) {
      setCheckingVideo(true);
      try {
        const { width, height } = await probeVideoDimensions(f);
        if (Math.max(width, height) > MAX_VIDEO_DIMENSION) {
          setIncompatibleRes({ width, height }); setMediaFile(null); setCheckingVideo(false); return;
        }
      } catch { /* se não for possível ler a resolução, deixa o navegador tentar normalmente */ }
      setCheckingVideo(false);
    }
    setMediaFile(f);
  };

  // Reordenação das imagens extras — a ordem final define a ordem exibida no carrossel do site
  const moveExtraImage = (from: number, to: number) => {
    if (to < 0 || to >= extraImageFiles.length) return;
    setExtraImageFiles(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };
  const removeExtraImage = (i: number) => setExtraImageFiles(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!title.trim() || busy) return;
    setBusy(true); setErrMsg("");

    if (tab === "audio") {
      if (!audioFile || !ghConfigured) { setErrMsg("Configure o GitHub e selecione um arquivo."); setBusy(false); return; }
      const url = await uploadFile(audioFile, "audio", setProgress);
      if (!url) { setErrMsg("Falha no upload."); setBusy(false); return; }
      let coverUrl: string | undefined;
      if (audioCoverFile) { const cu = await uploadFile(audioCoverFile, "image", setProgress2); if (cu) coverUrl = cu; }
      await onSaveAudio({ id: `audio-${Date.now()}`, title: title.trim(), artist: artist.trim() || undefined, genre: genre.trim() || undefined, url, coverUrl, createdAt: Date.now() });
      setDone(true); setTimeout(() => { reset(); onClose(); }, 1000);
      return;
    }

    const embedReady = (mode === "youtube" || mode === "vimeo") && !!parsedVideo;
    if (embedReady) {
      await onSave({ id: `proj-${Date.now()}`, title: title.trim(), description: desc.trim(), category: cat, mediaType: "embed", mediaUrl: parsedVideo!.embed, thumbUrl: parsedVideo!.thumb || undefined, embedPlatform: parsedVideo!.platform, embedId: parsedVideo!.id, createdAt: Date.now() });
      setDone(true); setTimeout(() => { reset(); onClose(); }, 1000);
      return;
    }

    if (!mediaFile || !ghConfigured) { setErrMsg("Configure o GitHub e selecione um arquivo."); setBusy(false); return; }
    if (incompatibleRes) { setErrMsg("Resolução do vídeo incompatível com celulares. Reduza para até 1920px no lado maior."); setBusy(false); return; }
    const mType = mediaFile.type.startsWith("video") ? "video" : "image";
    const mediaUrl = await uploadFile(mediaFile, mType, setProgress);
    if (!mediaUrl) { setErrMsg("Falha no upload."); setBusy(false); return; }

    // Upload extras (carrossel) — mantém a ordem escolhida pelo administrador
    let imagesUrls: string[] = [];
    if (mType === "image" && isCarousel) {
      imagesUrls = [mediaUrl];
      for (let i = 0; i < extraImageFiles.length; i++) {
        const u = await uploadFile(extraImageFiles[i], "image", () => {});
        if (u) imagesUrls.push(u);
      }
    }

    let thumbUrl: string | undefined;
    if (thumbFile) { const tu = await uploadFile(thumbFile, "image", setProgress2); if (tu) thumbUrl = tu; }

    await onSave({
      id: `proj-${Date.now()}`, title: title.trim(), description: desc.trim(), category: cat,
      mediaType: mType, mediaUrl,
      images: imagesUrls.length > 1 ? imagesUrls : undefined,
      isCarousel: imagesUrls.length > 1 ? true : undefined,
      thumbUrl, createdAt: Date.now(),
    });
    setDone(true); setTimeout(() => { reset(); onClose(); }, 1000);
  };

  if (!open) return null;

  const embedReady = (mode === "youtube" || mode === "vimeo") && !!parsedVideo;
  const canSave = title.trim() && !busy && (
    tab === "audio" ? (!!audioFile && ghConfigured) :
    embedReady || (mode === "file" && !!mediaFile && ghConfigured)
  );

  return (
    <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={() => { if (!busy) { reset(); onClose(); } }} />
      <div className="relative z-10 w-full max-w-xl bg-card border border-border border-b-0 sm:border-b flex flex-col max-h-[96vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">Novo Conteúdo</div>
            <h2 className="text-xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Adicionar ao Portfólio</h2>
          </div>
          <button onClick={() => { if (!busy) { reset(); onClose(); } }} className="w-9 h-9 flex items-center justify-center border border-border text-muted-foreground"><X size={15} /></button>
        </div>

        <div className="flex border-b border-border flex-shrink-0">
          {([["video", <VideoIcon size={12} />, "Vídeo"], ["image", <ImageIcon size={12} />, "Imagem"], ["audio", <Music size={12} />, "Áudio"]] as const).map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-4 py-3 font-mono text-[10px] tracking-widest uppercase border-b-2 transition-colors ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {icon}{label}
            </button>
          ))}
        </div>

        {!ghConfigured && (
          <div className="mx-5 mt-4 flex items-start gap-3 border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/80 font-light">Configure o GitHub antes de fazer uploads.</p>
          </div>
        )}

        <div className="p-5 space-y-4">
          {tab === "audio" && (<>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Arquivo de áudio * (MP3, WAV, AAC, M4A, OGG, FLAC)</label>
              <div className={`border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${audioFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("audio-inp")?.click()}>
                <input id="audio-inp" type="file" accept={AUDIO_ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAudioFile(f); e.target.value = ""; }} />
                {audioFile ? <div className="flex items-center justify-center gap-2 text-primary"><Music size={16} /><span className="text-sm truncate max-w-[200px]">{audioFile.name}</span></div>
                  : <div className="flex flex-col items-center gap-2 text-muted-foreground"><Music size={20} /><span className="text-xs font-mono tracking-wider uppercase">Selecionar áudio</span></div>}
              </div>
              {progress && <div className="mt-2"><UploadProgressBar progress={progress} /></div>}
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Capa (opcional)</label>
              <div className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${audioCoverFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("audio-cover-inp")?.click()}>
                <input id="audio-cover-inp" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAudioCoverFile(f); e.target.value = ""; }} />
                {audioCoverFile ? <div className="flex items-center justify-center gap-2 text-primary"><ImageIcon size={14} /><span className="text-sm truncate">{audioCoverFile.name}</span></div>
                  : <div className="flex items-center justify-center gap-2 text-muted-foreground"><ImageIcon size={14} /><span className="text-xs font-mono tracking-wider uppercase">Arte / capa</span></div>}
              </div>
              {progress2 && <div className="mt-2"><UploadProgressBar progress={progress2} /></div>}
            </div>
            <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Título da faixa *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome da música / EP / álbum" className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
            <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Artista / feat. (opcional)</label><input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Frederico Pierre" className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Gênero musical (opcional)</label>
              <div className="flex flex-wrap gap-1.5">
                {AUDIO_GENRES.map(g => (
                  <button key={g} type="button" onClick={() => setGenre(genre === g ? "" : g)} className={`font-mono text-[9px] tracking-wider uppercase px-2.5 py-1.5 border transition-colors ${genre === g ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}>{g}</button>
                ))}
              </div>
              {genre && <p className="font-mono text-[10px] text-primary mt-1.5">Selecionado: {genre}</p>}
            </div>
          </>)}

          {tab !== "audio" && (<>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {([["file", <Upload size={13} />, "Arquivo"], ["youtube", <Youtube size={13} />, "YouTube"], ["vimeo", <Link2 size={13} />, "Vimeo"]] as const).map(([id, icon, label]) => (
                  <button key={id} onClick={() => setMode(id)} className={`flex flex-col items-center gap-1.5 py-3 border transition-colors font-mono text-[10px] tracking-widest uppercase ${mode === id ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "file" && (<>
              <div>
                <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">{tab === "image" ? "Imagem principal *" : "Vídeo * (até 25 MB)"}</label>
                <div className={`border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${mediaFile ? "border-primary bg-primary/5" : (oversize || incompatibleRes) ? "border-red-500/60" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("media-inp")?.click()}>
                  <input id="media-inp" type="file" accept={tab === "image" ? "image/*" : "image/*,video/mp4,video/mov,video/webm,video/quicktime"} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); e.target.value = ""; }} />
                  {checkingVideo ? <div className="flex items-center justify-center gap-2 text-muted-foreground"><span className="text-xs font-mono tracking-wider uppercase">Verificando vídeo...</span></div>
                    : mediaFile ? <div className="flex items-center justify-center gap-2 text-primary">{mediaFile.type.startsWith("video") ? <VideoIcon size={16} /> : <ImageIcon size={16} />}<span className="text-sm truncate max-w-[200px]">{mediaFile.name}</span></div>
                    : <div className="flex flex-col items-center gap-2 text-muted-foreground"><Upload size={20} /><span className="text-xs font-mono tracking-wider uppercase">Toque ou arraste</span></div>}
                </div>
                {oversize && <div className="mt-3 border border-red-500/30 bg-red-500/5 p-3"><p className="text-xs text-red-300 font-light flex items-center gap-2"><AlertCircle size={12} />Vídeo &gt; 25 MB — use YouTube ou Vimeo.</p></div>}
                {incompatibleRes && <div className="mt-3 border border-red-500/30 bg-red-500/5 p-3"><p className="text-xs text-red-300 font-light flex items-center gap-2"><AlertCircle size={12} />Vídeo {incompatibleRes.width}x{incompatibleRes.height} — resolução alta demais, não reproduz em celulares. Reexporte com o lado maior em até {MAX_VIDEO_DIMENSION}px.</p></div>}
                {progress && <div className="mt-2"><UploadProgressBar progress={progress} /></div>}
              </div>

              {tab === "image" && (
                <div>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <button
                      type="button"
                      onClick={() => setIsCarousel(v => !v)}
                      aria-pressed={isCarousel}
                      className={`w-5 h-5 flex-shrink-0 flex items-center justify-center border transition-colors ${isCarousel ? "bg-primary border-primary text-background" : "border-border text-transparent"}`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                    <span className="font-mono text-[10px] text-foreground tracking-widest uppercase">Projeto em Carrossel</span>
                  </label>
                  <p className="font-mono text-[9px] text-muted-foreground/60 mt-1 ml-[30px]">Permite várias imagens no mesmo projeto — exibidas como carrossel estilo Instagram no site.</p>

                  {isCarousel && (
                    <div className="mt-3 ml-[30px]">
                      <div className="border-2 border-dashed border-border p-4 text-center cursor-pointer hover:border-primary/40 transition-colors" onClick={() => document.getElementById("extra-images-inp")?.click()}>
                        <input id="extra-images-inp" type="file" accept="image/*" multiple className="hidden" onChange={e => { setExtraImageFiles(prev => [...prev, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
                        <div className="flex items-center justify-center gap-2 text-muted-foreground"><ImageIcon size={14} /><span className="text-xs font-mono tracking-wider uppercase">Adicionar mais imagens</span></div>
                      </div>
                      <p className="font-mono text-[9px] text-muted-foreground/60 mt-1">A imagem principal acima entra como 1ª foto do carrossel. Use as setas para reordenar.</p>

                      {extraImageFiles.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {extraImageFiles.map((f, i) => (
                            <li key={`${f.name}-${i}`} className="flex items-center gap-2 bg-muted border border-border px-2.5 py-2">
                              <GripVertical size={12} className="text-muted-foreground/50 flex-shrink-0" />
                              <span className="font-mono text-[9px] text-muted-foreground flex-shrink-0">#{i + 2}</span>
                              <span className="text-xs text-foreground truncate flex-1">{f.name}</span>
                              <button type="button" disabled={i === 0} onClick={() => moveExtraImage(i, i - 1)} className="w-6 h-6 flex items-center justify-center text-muted-foreground disabled:opacity-25 hover:text-primary"><ChevronUp size={12} /></button>
                              <button type="button" disabled={i === extraImageFiles.length - 1} onClick={() => moveExtraImage(i, i + 1)} className="w-6 h-6 flex items-center justify-center text-muted-foreground disabled:opacity-25 hover:text-primary"><ChevronDown size={12} /></button>
                              <button type="button" onClick={() => removeExtraImage(i)} className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Thumbnail (opcional)</label>
                <div className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${thumbFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById("thumb-inp")?.click()}>
                  <input id="thumb-inp" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setThumbFile(f); e.target.value = ""; }} />
                  {thumbFile ? <div className="flex items-center justify-center gap-2 text-primary"><ImageIcon size={14} /><span className="text-sm truncate">{thumbFile.name}</span></div>
                    : <div className="flex items-center justify-center gap-2 text-muted-foreground"><ImageIcon size={14} /><span className="text-xs font-mono tracking-wider uppercase">Capa</span></div>}
                </div>
                {progress2 && <div className="mt-2"><UploadProgressBar progress={progress2} /></div>}
              </div>
            </>)}

            {(mode === "youtube" || mode === "vimeo") && (
              <div>
                <label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">URL *</label>
                <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder={mode === "youtube" ? "https://youtube.com/watch?v=..." : "https://vimeo.com/123456789"} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" />
                {videoUrl && !parsedVideo && <p className="font-mono text-[10px] text-amber-400 mt-1.5 flex items-center gap-1"><AlertCircle size={10} />URL não reconhecida.</p>}
                {parsedVideo && (
                  <div className="mt-3 border border-green-500/20 bg-green-500/5 p-3 space-y-2">
                    <div className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-400" /><span className="font-mono text-[10px] text-green-400 uppercase">{parsedVideo.platform} detectado</span></div>
                    {parsedVideo.thumb && thumbImgOk ? <img src={parsedVideo.thumb} alt="preview" className="w-full aspect-video object-cover" onError={() => setThumbImgOk(false)} />
                      : <div className="w-full aspect-video bg-muted flex items-center justify-center gap-2"><Youtube size={20} className="text-muted-foreground" /><span className="font-mono text-[10px] text-muted-foreground">ID: {parsedVideo.id}</span></div>}
                  </div>
                )}
              </div>
            )}

            <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Título *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do projeto" className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
            <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Descrição</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary resize-none" /></div>
            <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Categoria</label>
              <div className="grid grid-cols-2 gap-2">{CATEGORIES.map(c => <button key={c} onClick={() => setCat(c)} className={`font-mono text-[10px] tracking-widest uppercase px-3 py-2.5 border transition-colors text-left ${cat === c ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{c}</button>)}</div>
            </div>
          </>)}
        </div>

        {errMsg && <div className="mx-5 mb-3 flex items-center gap-2 border border-red-500/30 bg-red-500/5 px-3 py-3"><AlertCircle size={13} className="text-red-400 flex-shrink-0" /><span className="text-sm text-red-300 font-light">{errMsg}</span></div>}

        <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <button onClick={() => { if (!busy) { reset(); onClose(); } }} className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} className={`flex items-center gap-2 px-6 py-3 font-bold text-xs tracking-widest uppercase transition-all ${done ? "bg-green-600 text-white" : !canSave ? "bg-muted text-muted-foreground cursor-not-allowed" : busy ? "bg-primary/60 text-background" : "bg-primary text-background"}`}>
            {done ? <><Check size={13} /> Salvo!</> : busy ? <><Loader2 size={13} className="animate-spin" />Enviando...</> : <><Upload size={13} /> Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
