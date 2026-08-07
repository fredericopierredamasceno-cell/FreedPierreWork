import { Music, ImageIcon, VideoIcon } from "lucide-react";
import type { UploadProgress } from "../../lib/types";
import { UploadProgressBar } from "../UploadProgressBar";

type PreviewKind = "image" | "video" | "audio-cover";

/**
 * Preview + botão de troca de arquivo, reutilizado por qualquer editor de
 * mídia (áudio, vídeo, imagem). Mantém o mesmo padrão visual em todas as
 * categorias em vez de reimplementar o drop-zone em cada modal.
 */
export function MediaReplaceField({
  label, previewUrl, previewKind, inputId, accept, file, onFileChange, progress, compact,
}: {
  label: string;
  previewUrl?: string;
  previewKind: PreviewKind;
  inputId: string;
  accept: string;
  file: File | null;
  onFileChange: (f: File) => void;
  progress?: UploadProgress | null;
  compact?: boolean;
}) {
  const Icon = previewKind === "video" ? VideoIcon : previewKind === "audio-cover" ? Music : ImageIcon;

  return (
    <div className={compact ? "flex items-center gap-4" : ""}>
      {previewUrl !== undefined && (
        <div className={`${compact ? "w-16 h-16" : "w-full aspect-video mb-2"} border border-border flex-shrink-0 overflow-hidden bg-muted`}>
          {previewUrl
            ? (previewKind === "video"
                ? <video src={previewUrl} muted className="w-full h-full object-cover" />
                : <img src={previewUrl} alt="" className="w-full h-full object-cover" />)
            : <div className="w-full h-full flex items-center justify-center"><Icon size={20} className="text-muted-foreground" /></div>}
        </div>
      )}
      <div className="flex-1">
        <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1.5">{label}</label>
        <div className={`border border-dashed p-2.5 text-center cursor-pointer transition-colors ${file ? "border-primary" : "border-border hover:border-primary/40"}`} onClick={() => document.getElementById(inputId)?.click()}>
          <input id={inputId} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFileChange(f); e.target.value = ""; }} />
          <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase">{file ? file.name.slice(0, 24) : "Selecionar arquivo"}</span>
        </div>
        {progress && <div className="mt-1.5"><UploadProgressBar progress={progress} /></div>}
      </div>
    </div>
  );
}
