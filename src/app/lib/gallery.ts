/* ═══════════════════════════════════════════════════════════════════
   Galeria de imagens — estrutura única usada por TODO projeto de imagem,
   mesmo quando tem apenas 1 foto. "Carrossel" deixou de ser uma opção
   separada: é apenas o resultado natural de a galeria ter mais de 1 item.

   Compatibilidade: projetos gravados no formato antigo (mediaUrl único,
   ou images como string[]) são convertidos automaticamente para o
   formato novo em memória, sem exigir nenhuma migração manual do JSON
   salvo no GitHub. Na próxima publicação o projeto já é regravado no
   formato novo.
═══════════════════════════════════════════════════════════════════ */
import type { CMSProject, GalleryImage, UploadProgress } from "./types";

export function genImgId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Normaliza um único projeto: garante `images: GalleryImage[]` ordenado,
 *  com exatamente 1 imagem marcada `isMain`, e `mediaUrl` sincronizado
 *  com a imagem principal (mantém compatibilidade com qualquer código
 *  legado que ainda leia `mediaUrl` diretamente). */
export function normalizeProjectImages(p: CMSProject): CMSProject {
  if (p.mediaType !== "image") return p;
  const raw = p.images as unknown;
  let images: GalleryImage[];

  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
    // formato intermediário (carrossel v1): array de URLs simples
    images = (raw as string[]).filter(Boolean).map((url, i) => ({
      id: genImgId(), url, order: i, isMain: i === 0, uploadedAt: p.createdAt || Date.now(),
    }));
  } else if (Array.isArray(raw) && raw.length > 0) {
    images = (raw as GalleryImage[])
      .filter(img => img && img.url)
      .map((img, i) => ({
        id: img.id || genImgId(), url: img.url, order: typeof img.order === "number" ? img.order : i,
        caption: img.caption, alt: img.alt, isMain: !!img.isMain, uploadedAt: img.uploadedAt || p.createdAt || Date.now(),
      }))
      .sort((a, b) => a.order - b.order)
      .map((img, i) => ({ ...img, order: i }));
    // Garante no máximo 1 capa: se nenhuma vier marcada, usa a primeira; se
    // vier mais de uma marcada (dado externo corrompido), mantém só a primeira.
    const mainIdx = images.findIndex(i => i.isMain);
    images = images.map((img, i) => ({ ...img, isMain: i === (mainIdx === -1 ? 0 : mainIdx) }));
  } else if (p.mediaUrl) {
    // projeto antigo — apenas 1 imagem principal, sem galeria
    images = [{ id: genImgId(), url: p.mediaUrl, order: 0, isMain: true, uploadedAt: p.createdAt || Date.now() }];
  } else {
    images = [];
  }

  const main = images.find(i => i.isMain) ?? images[0];
  return { ...p, images, mediaUrl: main ? main.url : p.mediaUrl, isCarousel: undefined };
}

export function normalizeProjects(list: CMSProject[]): CMSProject[] {
  return (list ?? []).map(normalizeProjectImages);
}

export function reorderImages(images: GalleryImage[], from: number, to: number): GalleryImage[] {
  if (to < 0 || to >= images.length || from === to) return images;
  const arr = [...images];
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);
  return arr.map((img, i) => ({ ...img, order: i }));
}

export function setMainImage(images: GalleryImage[], id: string): GalleryImage[] {
  return images.map(img => ({ ...img, isMain: img.id === id }));
}

export function removeImageFromGallery(images: GalleryImage[], id: string): GalleryImage[] {
  const wasMain = images.find(img => img.id === id)?.isMain;
  const filtered = images.filter(img => img.id !== id).map((img, i) => ({ ...img, order: i }));
  if (wasMain && filtered.length) filtered[0] = { ...filtered[0], isMain: true };
  return filtered;
}

/**
 * Item de galeria como manipulado pelo editor (UploadModal / EditProjectModal):
 * ou já publicado (`existing`, com URL final), ou um arquivo novo local que
 * ainda passa por `pending` → `uploading` → `done`/`error`.
 */
export type GalleryDraftItem = {
  id: string;
  file?: File;
  previewUrl: string;
  finalUrl?: string;
  isMain: boolean;
  status: "existing" | "pending" | "uploading" | "done" | "error";
  progress?: UploadProgress | null;
  error?: string;
};

export function draftFromExisting(img: GalleryImage): GalleryDraftItem {
  return { id: img.id, previewUrl: img.url, finalUrl: img.url, isMain: img.isMain, status: "existing" };
}

/**
 * Envia sequencialmente todos os itens `pending`/`error` de uma galeria,
 * atualizando o status de CADA imagem em tempo real via `setItems` — é
 * isso que faz o upload das imagens extras aparecer na tela em vez de
 * acontecer "silenciosamente" em segundo plano (o problema relatado).
 *
 * Uma pequena pausa entre uploads evita o rate-limit secundário da API do
 * GitHub quando a galeria tem muitas imagens (10, 20...).
 *
 * Nunca descarta uma imagem que falhou: ela fica com status "error" e é
 * reportada em `hadErrors`, para o modal avisar o admin em vez de publicar
 * silenciosamente só as que deram certo.
 */
export async function uploadGalleryItems(
  items: GalleryDraftItem[],
  uploadFile: (f: File, t: "image", onProgress: (p: UploadProgress) => void) => Promise<string | null>,
  setItems: (updater: (prev: GalleryDraftItem[]) => GalleryDraftItem[]) => void,
): Promise<{ images: GalleryImage[]; hadErrors: boolean }> {
  const working = [...items];
  for (let i = 0; i < working.length; i++) {
    const it = working[i];
    if (it.status === "existing" || it.status === "done") continue;
    setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: "uploading", progress: null, error: undefined } : p));
    try {
      const url = await uploadFile(it.file!, "image", (p) => {
        setItems(prev => prev.map(x => x.id === it.id ? { ...x, progress: p } : x));
      });
      if (!url) throw new Error("Falha no upload");
      working[i] = { ...it, status: "done", finalUrl: url };
      setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: "done", finalUrl: url } : p));
      await new Promise(r => setTimeout(r, 350));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no upload";
      working[i] = { ...it, status: "error", error: msg };
      setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: "error", error: msg } : p));
    }
  }
  const hadErrors = working.some(i => i.status === "error");
  const images: GalleryImage[] = working
    .filter(i => i.status === "done" || i.status === "existing")
    .map((i, idx) => ({
      id: i.id.startsWith("new-") ? genImgId() : i.id,
      url: (i.finalUrl || i.previewUrl) as string,
      order: idx,
      isMain: i.isMain,
      uploadedAt: Date.now(),
    }));
  if (images.length && !images.some(i => i.isMain)) images[0].isMain = true;
  return { images, hadErrors };
}
