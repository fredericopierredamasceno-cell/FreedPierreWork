/* Ponto único de decisão de qual StorageProvider está ativo.
   Trocar o backend de armazenamento no futuro = mudar só este arquivo
   (e criar o novo provider ao lado de githubStorageProvider.ts) — nenhum
   componente do CMS ou do Media Manager precisa ser tocado. */
import type { GitHubConfig } from "../types";
import { createGitHubStorageProvider } from "./githubStorageProvider";

export type { StorageProvider, MediaKind } from "./types";

export function getActiveStorageProvider(cfg: GitHubConfig | null) {
  return createGitHubStorageProvider(cfg);
}
