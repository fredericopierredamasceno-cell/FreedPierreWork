/* ═══════════════════════════════════════════════════════════════════
   Storage Provider — contrato entre o Media Manager e o backend físico
   de armazenamento de arquivos.

   Hoje existe apenas um provider (GitHub, ver ./githubStorageProvider.ts).
   Nenhum componente do CMS deve chamar a API do GitHub (ou de qualquer
   outro backend) diretamente para enviar/remover mídia — todos devem
   depender apenas desta interface. Isso é o que permite, no futuro,
   trocar o backend físico (outro object storage, por exemplo) sem
   reescrever o Media Manager nem os componentes que o usam:

     Media Manager → StorageProvider → GitHub (hoje)
     Media Manager → StorageProvider → <outro storage> (futuro)
═══════════════════════════════════════════════════════════════════ */
import type { UploadProgress } from "../types";

/** Categoria física do arquivo — usada pelo provider para decidir pasta/
 *  bucket/prefixo de destino. "document" já está previsto (PDF, etc.)
 *  mesmo sem uso hoje, para não exigir mudança de contrato quando esse
 *  tipo for implementado. */
export type MediaKind = "image" | "video" | "audio" | "document";

export interface StorageProvider {
  /** Identificador do provider ativo (ex: "github"). Útil para logs/depuração. */
  readonly id: string;

  /** Indica se o provider tem tudo que precisa (credenciais, config) para
   *  operar agora. A UI usa isso para habilitar/desabilitar upload. */
  isConfigured(): boolean;

  /** Envia um arquivo e retorna a URL pública final, já pronta para ser
   *  salva em qualquer entidade do CMS (CMSProject.mediaUrl, GalleryImage.url,
   *  CMSAudio.url, etc). O `onProgress` mantém o mesmo formato já usado em
   *  todo o CMS (UploadProgress), então nenhum componente de UI precisa mudar. */
  upload(file: File, kind: MediaKind, onProgress: (p: UploadProgress) => void): Promise<string>;

  /** Remove um arquivo físico a partir da URL pública salva no CMS. Deve ser
   *  tolerante a falhas (nunca lançar por arquivo já removido/inexistente),
   *  seguindo o mesmo comportamento que `ghDeleteFile` já tem hoje. */
  remove(publicUrl: string): Promise<void>;
}
