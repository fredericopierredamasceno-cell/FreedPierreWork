import type { UploadProgress } from "./types";

/* Formatting helpers for upload/progress display */
export function fmtBytes(b: number) {
  if (b < 1024) return `${b.toFixed(0)} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
export function fmtSpeed(bps: number) {
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(2)} MB/s`;
}
export function fmtETA(s: number) {
  if (!isFinite(s) || s <= 0) return "";
  return s < 60 ? `~${Math.ceil(s)}s` : `~${Math.ceil(s / 60)}min`;
}
export function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
export const PHASE_LABELS: Record<UploadProgress["phase"], string> = {
  preparing: "Preparando", sending: "Enviando", processing: "Processando", done: "Concluído", error: "Erro",
};
