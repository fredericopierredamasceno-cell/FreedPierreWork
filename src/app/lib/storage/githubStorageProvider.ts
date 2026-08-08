/* ═══════════════════════════════════════════════════════════════════
   GitHubStorageProvider — único StorageProvider ativo hoje.

   Não duplica nem reescreve a lógica de `../github.ts`: apenas encapsula
   as mesmas funções (`ghUploadBinary`, `ghDeleteFile`) atrás do contrato
   `StorageProvider`, para que o restante do CMS deixe de depender do
   GitHub diretamente. O comportamento de upload/remoção continua
   byte-a-byte o mesmo de antes (mesmas pastas, mesmo formato de URL,
   mesmo limite de tamanho em MAX_FILE_BYTES).
═══════════════════════════════════════════════════════════════════ */
import type { GitHubConfig } from "../types";
import type { MediaKind, StorageProvider } from "./types";
import { ghUploadBinary, ghDeleteFile } from "../github";

// Mesmas pastas que já eram usadas em useCMS.ts antes desta refatoração.
const FOLDER_BY_KIND: Record<MediaKind, string> = {
  image: "public/uploads/images",
  video: "public/uploads/videos",
  audio: "public/uploads/audio",
  document: "public/uploads/documents",
};

export function createGitHubStorageProvider(cfg: GitHubConfig | null): StorageProvider {
  return {
    id: "github",
    isConfigured: () => !!cfg?.token,
    async upload(file, kind, onProgress) {
      if (!cfg?.token) throw new Error("GitHub não configurado.");
      return ghUploadBinary(cfg, FOLDER_BY_KIND[kind], file, onProgress);
    },
    async remove(publicUrl) {
      if (!cfg?.token || !publicUrl.startsWith("/uploads/")) return;
      await ghDeleteFile(cfg, publicUrl);
    },
  };
}
