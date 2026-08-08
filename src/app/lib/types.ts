/* Shared TypeScript types for the CMS / admin domain */
import type { SiteContent, SiteTheme } from "./defaults";
export interface GitHubConfig { owner: string; repo: string; branch: string; token: string; }
export interface UploadProgress {
  phase: "preparing" | "sending" | "processing" | "done" | "error";
  percent: number; bytesSent: number; bytesTotal: number; speed: number; eta: number;
}

export interface LogEntry { id: string; ts: Date; level: "info" | "success" | "error" | "warn"; msg: string; }
export interface PublishStep { id: string; label: string; status: "pending" | "running" | "done" | "error"; error?: string; }

// Uma imagem dentro da galeria de um projeto. Todo projeto de imagem usa
// essa estrutura — mesmo quando tem 1 única foto — para que a arquitetura
// não precise mudar quando o projeto ganha mais imagens depois.
export interface GalleryImage {
  id: string;
  url: string;
  order: number;
  caption?: string;       // legenda opcional, exibida futuramente por imagem
  alt?: string;            // texto alternativo opcional (acessibilidade/SEO)
  isMain: boolean;         // imagem usada como capa (thumbnail do card, mediaUrl legado)
  uploadedAt: number;
}

export interface CMSProject {
  id: string; title: string; description: string; category: string;
  subcategory?: string; // subcategoria opcional, gerenciada via CMS (ex: dentro de "Design Gráfico")
  mediaType: "image" | "video" | "embed";
  mediaUrl: string; // legado: sempre igual à URL da imagem marcada como principal em `images` (mantido para compatibilidade com código/HTML antigos que ainda leem mediaUrl direto)
  thumbUrl?: string;
  images?: GalleryImage[]; // galeria completa do projeto (tipo "image") — 1 imagem já usa esta estrutura
  /** @deprecated não é mais gravado — o carrossel é inferido de `images.length > 1`. Mantido só para ler dados antigos. */
  isCarousel?: boolean;
  embedPlatform?: "youtube" | "vimeo"; embedId?: string;
  isFixed?: boolean; createdAt: number;
  hidden?: boolean; // ocultar da visualização pública sem apagar (admin ainda vê) — vale para vídeo, imagem, motion, design gráfico e qualquer categoria futura
}
export type DisplayProject = CMSProject;

export interface CMSAudio {
  id: string; title: string; artist?: string;
  genre?: string; // gênero musical ex: "Trap", "Eletrônico", "Gospel"
  url: string; coverUrl?: string; createdAt: number;
  hidden?: boolean; // ocultar da visualização pública (admin ainda vê)
  isFeatured?: boolean; // fixado como capa principal da seção "Produções" (apenas uma por vez)
}

export interface CMSServiceContent {
  title: string; description: string; tags: string[];
}

// Lançamento oficial já disponível em plataformas de streaming — seção
// "Ouça nas plataformas", independente do player de prévias (CMSAudio).
export interface CMSRelease {
  id: string; title: string; artist: string; coverUrl?: string;
  spotifyUrl: string; // obrigatório
  appleMusicUrl?: string; deezerUrl?: string; youtubeMusicUrl?: string; // opcionais
  createdAt: number;
  hidden?: boolean; // ocultar da visualização pública sem apagar (admin ainda vê)
}

export interface CMSAdvantageContent {
  title: string; body: string;
}

export interface CMSData {
  content: SiteContent;
  theme: SiteTheme;
  services: CMSServiceContent[];
  advantages: CMSAdvantageContent[];
  projects: CMSProject[];
  audios: CMSAudio[];
  releases: CMSRelease[];
  pinned: string[];
  hiddenSeeds: string[];
  designCategories: string[]; // subcategorias do portfólio de Design Gráfico, criadas via CMS (não fixas no código)
  updatedAt: string;
}
export type SaveStatus = "idle" | "saving" | "success" | "error";
export type UploadMode = "file" | "youtube" | "vimeo";
export type UploadMediaType = "video" | "image" | "audio";
export type AdminTab = "github" | "midias" | "uploads" | "textos" | "servicos" | "cores" | "info" | "logs";
