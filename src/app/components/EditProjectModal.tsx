import { useState, useEffect, useRef } from "react";
import { Youtube, AlertCircle, CheckCircle2 } from "lucide-react";
import type { CMSProject, UploadProgress } from "../lib/types";
import { CATEGORIES, DESIGN_SERVICE_TITLE } from "../lib/defaults";
import { parseVideoUrl } from "../lib/video";
import { draftFromExisting, uploadGalleryItems, type GalleryDraftItem } from "../lib/gallery";
import { EditModalShell } from "./edit/EditModalShell";
import { MediaReplaceField } from "./edit/MediaReplaceField";
import { VisibilityToggleButton } from "./edit/VisibilityToggleButton";
import { GalleryManager } from "./GalleryManager";

/**
 * Edição completa para vídeos, imagens (galeria) e embeds
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

  // imagem — galeria (mesmo com 1 foto, mesma estrutura de quando tem várias)
  const [gallery, setGallery] = useState<GalleryDraftItem[]>([]);
  const [galleryErr, setGalleryErr] = useState("");

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
      const baseImages = project.images && project.images.length
        ? project.images
        : [{ id: "legacy-0", url: project.mediaUrl, order: 0, isMain: true, uploadedAt: project.createdAt }];
      setGallery(baseImages.map(draftFromExisting));
      setGalleryErr("");
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
  // longas de admin com muitas trocas de imagem na galeria.
  const galleryUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const current = new Set(gallery.filter(s => s.file).map(s => s.previewUrl));
    for (const url of galleryUrlsRef.current) {
      if (!current.has(url)) URL.revokeObjectURL(url);
    }
    galleryUrlsRef.current = current;
  }, [gallery]);
  useEffect(() => {
    return () => { galleryUrlsRef.current.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  if (!open || !project) return null;

  const handleSave = async () => {
    if (!title.trim() || busy) return;
    setBusy(true); setGalleryErr("");

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
      if (gallery.length === 0) { setGalleryErr("Adicione ao menos 1 imagem."); setBusy(false); return; }
      const { images, hadErrors } = await uploadGalleryItems(gallery, uploadFile, setGallery);
      if (images.length === 0) { setGalleryErr("Nenhuma imagem foi enviada — verifique a conexão e tente novamente."); setBusy(false); return; }
      if (hadErrors) { setGalleryErr("Uma ou mais imagens falharam — tente novamente antes de salvar."); setBusy(false); return; }
      const main = images.find(i => i.isMain) ?? images[0];
      updated.images = images;
      updated.mediaUrl = main.url;
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
          <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">Galeria de imagens</label>
          <GalleryManager items={gallery} onChange={setGallery} disabled={busy || !ghConfigured} addLabel="Adicionar mais imagens" />
          {galleryErr && <p className="font-mono text-[10px] text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle size={10} />{galleryErr}</p>}
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
