import { useState, useEffect, useRef } from "react";
import { Youtube, ImageIcon, Plus, X as XIcon, AlertCircle, CheckCircle2, ChevronUp, ChevronDown, GripVertical, Check } from "lucide-react";
import type { CMSProject, UploadProgress } from "../lib/types";
import { CATEGORIES, DESIGN_SERVICE_TITLE } from "../lib/defaults";
import { parseVideoUrl } from "../lib/video";
import { EditModalShell } from "./edit/EditModalShell";
import { MediaReplaceField } from "./edit/MediaReplaceField";
import { VisibilityToggleButton } from "./edit/VisibilityToggleButton";
import { UploadProgressBar } from "./UploadProgressBar";

type GallerySlot = { id: string; kind: "existing"; url: string } | { id: string; kind: "new"; file: File; previewUrl: string };

/**
 * Edição completa para vídeos, imagens (com carrossel) e embeds
 * (YouTube/Vimeo). Segue o mesmo padrão do EditAudioModal
 * (EditModalShell + MediaReplaceField) para que vídeo, imagem, motion,
 * design gráfico e futuras categorias compartilhem o mesmo comportamento
 * de gerenciamento sem duplicar UI.
 */
export function EditProjectModal({ project, open, onClose, onSave, onToggleHidden, uploadFile, ghConfigured, designCategories }: {
  project: CMSProject | null; open: boolean; onClose: () => void;
  onSave: (updated: CMSProject) => Promise<void>;
  onToggleHidden: (id: string) => void;
  uploadFile: (f: File, t: "image" | "video" | "audio", onProgress: (p: UploadProgress) => void) => Promise<string | null>;
  ghConfigured: boolean;
  designCategories: string[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState("");

  // vídeo
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);

  // imagem / carrossel
  const [isCarousel, setIsCarousel] = useState(false);
  const [gallery, setGallery] = useState<GallerySlot[]>([]);

  // embed
  const [embedUrl, setEmbedUrl] = useState("");
  const [parsedEmbed, setParsedEmbed] = useState<ReturnType<typeof parseVideoUrl>>(null);

  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [progress2, setProgress2] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setDescription(project.description);
      setCategory(project.category);
      setSubcategory(project.subcategory ?? "");
      setIsCarousel(!!project.isCarousel);
      const baseImages = project.images && project.images.length ? project.images : [project.mediaUrl];
      setGallery(baseImages.map((url, i) => ({ id: `existing-${i}-${url}`, kind: "existing", url })));
      setEmbedUrl(project.embedPlatform === "youtube" ? `https://youtube.com/watch?v=${project.embedId}` : project.embedPlatform === "vimeo" ? `https://vimeo.com/${project.embedId}` : "");
      setParsedEmbed(null);
    }
    setMediaFile(null); setThumbFile(null);
    setProgress(null); setProgress2(null); setBusy(false); setDone(false);
  }, [project, open]);

  useEffect(() => {
    if (project?.mediaType !== "embed") return;
    if (!embedUrl.trim()) { setParsedEmbed(null); return; }
    setParsedEmbed(parseVideoUrl(embedUrl.trim()));
  }, [embedUrl, project?.mediaType]);

  // Libera as object URLs criadas para pré-visualizar novas imagens locais
  // assim que deixam de estar em uso (removidas, ou substituídas ao reabrir
  // o modal com outro projeto) — evita vazamento de memória em sessões
  // longas de admin com muitas trocas de imagem no carrossel.
  const galleryUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const current = new Set(gallery.filter(s => s.kind === "new").map(s => s.previewUrl));
    for (const url of galleryUrlsRef.current) {
      if (!current.has(url)) URL.revokeObjectURL(url);
    }
    galleryUrlsRef.current = current;
  }, [gallery]);
  useEffect(() => {
    return () => { galleryUrlsRef.current.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  if (!open || !project) return null;

  const moveGallery = (from: number, to: number) => {
    if (to < 0 || to >= gallery.length) return;
    setGallery(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };
  const removeGallerySlot = (id: string) => setGallery(prev => prev.filter(s => s.id !== id));
  const addGalleryFiles = (files: FileList | null) => {
    if (!files) return;
    setGallery(prev => [...prev, ...Array.from(files).map((file, i) => ({ id: `new-${Date.now()}-${i}`, kind: "new" as const, file, previewUrl: URL.createObjectURL(file) }))]);
  };

  const handleSave = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);

    const updated: CMSProject = { ...project, title: title.trim(), description: description.trim(), category, subcategory: category === DESIGN_SERVICE_TITLE && subcategory ? subcategory : undefined };

    if (project.mediaType === "video") {
      if (mediaFile && ghConfigured) {
        const u = await uploadFile(mediaFile, "video", setProgress);
        if (u) updated.mediaUrl = u;
      }
      if (thumbFile && ghConfigured) {
        const u = await uploadFile(thumbFile, "image", setProgress2);
        if (u) updated.thumbUrl = u;
      }
    }

    if (project.mediaType === "image") {
      const finalUrls: string[] = [];
      for (const slot of gallery) {
        if (slot.kind === "existing") { finalUrls.push(slot.url); continue; }
        if (!ghConfigured) continue;
        const u = await uploadFile(slot.file, "image", setProgress);
        if (u) finalUrls.push(u);
      }
      if (finalUrls.length) updated.mediaUrl = finalUrls[0];
      updated.isCarousel = isCarousel && finalUrls.length > 1 ? true : undefined;
      updated.images = isCarousel && finalUrls.length > 1 ? finalUrls : undefined;
    }

    if (project.mediaType === "embed" && parsedEmbed) {
      updated.mediaUrl = parsedEmbed.embed;
      updated.thumbUrl = parsedEmbed.thumb || project.thumbUrl;
      updated.embedPlatform = parsedEmbed.platform;
      updated.embedId = parsedEmbed.id;
    }

    await onSave(updated);
    setDone(true);
    setTimeout(() => { setDone(false); onClose(); }, 600);
    setBusy(false);
  };

  const eyebrow = project.mediaType === "video" ? "Editar Vídeo" : project.mediaType === "image" ? "Editar Imagem" : "Editar Link (YouTube/Vimeo)";

  return (
    <EditModalShell
      eyebrow={eyebrow}
      title="Conteúdo"
      onClose={onClose}
      canSave={!!title.trim()}
      busy={busy}
      done={done}
      onSave={handleSave}
      extraHeaderAction={<VisibilityToggleButton hidden={!!project.hidden} onToggle={() => onToggleHidden(project.id)} size={11} />}
    >
      {project.mediaType === "video" && (
        <>
          <MediaReplaceField label="Trocar vídeo" previewUrl={project.mediaUrl} previewKind="video" inputId="edit-proj-video-inp" accept="video/mp4,video/mov,video/webm,video/quicktime" file={mediaFile} onFileChange={setMediaFile} progress={progress} />
          <MediaReplaceField label="Trocar thumbnail" previewUrl={project.thumbUrl} previewKind="image" inputId="edit-proj-thumb-inp" accept="image/*" file={thumbFile} onFileChange={setThumbFile} progress={progress2} compact />
        </>
      )}

      {project.mediaType === "image" && (
        <div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none mb-3">
            <button type="button" onClick={() => setIsCarousel(v => !v)} aria-pressed={isCarousel} className={`w-5 h-5 flex-shrink-0 flex items-center justify-center border transition-colors ${isCarousel ? "bg-primary border-primary text-background" : "border-border text-transparent"}`}>
              <Check size={12} strokeWidth={3} />
            </button>
            <span className="font-mono text-[10px] text-foreground tracking-widest uppercase">Projeto em Carrossel</span>
          </label>

          <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">{isCarousel ? "Imagens (carrossel)" : "Imagem"}</label>
          <ul className="space-y-1.5 mb-2">
            {gallery.map((slot, i) => (
              <li key={slot.id} className="flex items-center gap-2 bg-muted border border-border px-2.5 py-2">
                <div className="w-8 h-8 flex-shrink-0 border border-border overflow-hidden">
                  <img src={slot.kind === "existing" ? slot.url : slot.previewUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <GripVertical size={12} className="text-muted-foreground/50 flex-shrink-0" />
                <span className="text-xs text-foreground truncate flex-1">{slot.kind === "existing" ? `Imagem ${i + 1}` : slot.file.name}</span>
                {isCarousel && <>
                  <button type="button" disabled={i === 0} onClick={() => moveGallery(i, i - 1)} className="w-6 h-6 flex items-center justify-center text-muted-foreground disabled:opacity-25 hover:text-primary"><ChevronUp size={12} /></button>
                  <button type="button" disabled={i === gallery.length - 1} onClick={() => moveGallery(i, i + 1)} className="w-6 h-6 flex items-center justify-center text-muted-foreground disabled:opacity-25 hover:text-primary"><ChevronDown size={12} /></button>
                </>}
                {gallery.length > 1 && <button type="button" onClick={() => removeGallerySlot(slot.id)} className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-300"><XIcon size={12} /></button>}
              </li>
            ))}
          </ul>

          {isCarousel && (
            <div className="border border-dashed border-border p-2.5 text-center cursor-pointer hover:border-primary/40 transition-colors" onClick={() => document.getElementById("edit-proj-gallery-inp")?.click()}>
              <input id="edit-proj-gallery-inp" type="file" accept="image/*" multiple className="hidden" onChange={e => { addGalleryFiles(e.target.files); e.target.value = ""; }} />
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground"><Plus size={11} /><span className="font-mono text-[9px] tracking-wider uppercase">Adicionar imagens</span></div>
            </div>
          )}
          {!isCarousel && (
            <div className="border border-dashed border-border p-2.5 text-center cursor-pointer hover:border-primary/40 transition-colors" onClick={() => document.getElementById("edit-proj-gallery-inp")?.click()}>
              <input id="edit-proj-gallery-inp" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setGallery([{ id: `new-${Date.now()}`, kind: "new", file: f, previewUrl: URL.createObjectURL(f) }]); e.target.value = ""; }} />
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground"><ImageIcon size={11} /><span className="font-mono text-[9px] tracking-wider uppercase">Trocar imagem</span></div>
            </div>
          )}
          {progress && <div className="mt-1.5"><UploadProgressBar progress={progress} /></div>}
        </div>
      )}

      {project.mediaType === "embed" && (
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">URL (YouTube ou Vimeo)</label>
          <input value={embedUrl} onChange={e => setEmbedUrl(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
          {embedUrl && !parsedEmbed && <p className="font-mono text-[10px] text-amber-400 mt-1.5 flex items-center gap-1"><AlertCircle size={10} />URL não reconhecida.</p>}
          {parsedEmbed && (
            <div className="mt-2 border border-green-500/20 bg-green-500/5 p-2.5 space-y-2">
              <div className="flex items-center gap-2"><CheckCircle2 size={11} className="text-green-400" /><span className="font-mono text-[9px] text-green-400 uppercase">{parsedEmbed.platform} detectado</span></div>
              {parsedEmbed.thumb ? <img src={parsedEmbed.thumb} alt="" className="w-full aspect-video object-cover" /> : <div className="w-full aspect-video bg-muted flex items-center justify-center"><Youtube size={18} className="text-muted-foreground" /></div>}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Título *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
      </div>
      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Descrição</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
      </div>
      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Categoria</label>
        <div className="grid grid-cols-2 gap-1.5">
          {CATEGORIES.map(c => (
            <button key={c} type="button" onClick={() => { setCategory(c); if (c !== DESIGN_SERVICE_TITLE) setSubcategory(""); }} className={`font-mono text-[9px] tracking-widest uppercase px-2 py-2 border text-left transition-colors ${category === c ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{c}</button>
          ))}
        </div>
      </div>

      {category === DESIGN_SERVICE_TITLE && (
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Subcategoria (opcional)</label>
          <div className="flex flex-wrap gap-1.5">
            {designCategories.map(sc => (
              <button key={sc} type="button" onClick={() => setSubcategory(subcategory === sc ? "" : sc)} className={`font-mono text-[9px] tracking-wider uppercase px-2.5 py-1.5 border transition-colors ${subcategory === sc ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}>{sc}</button>
            ))}
          </div>
          {designCategories.length === 0 && <p className="font-mono text-[9px] text-muted-foreground/60 mt-1">Nenhuma subcategoria criada ainda — gerencie em Admin → Serviços.</p>}
        </div>
      )}
    </EditModalShell>
  );
}
