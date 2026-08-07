export const MAX_VIDEO_DIMENSION = 1920; // resolução máxima segura para decodificação garantida em hardware mobile (iOS/Android)

/* Video URL parsing (YouTube/Vimeo) + client-side resolution probing before upload */
// Lê apenas as dimensões do vídeo (via metadata do próprio navegador) antes do
// upload. Resoluções muito altas (ex: exports quadrados de 3000x3000 de apps
// de IA/edição) forçam o encoder a usar um nível H.264 que os decoders de
// hardware de celulares (iOS e a maioria dos Android) recusam reproduzir —
// o vídeo funciona no desktop (decodificação por software, mais tolerante)
// e simplesmente não reproduz no mobile, sem erro visível para o usuário.
export function probeVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const dims = { width: v.videoWidth, height: v.videoHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler o vídeo.")); };
    v.src = url;
  });
}
export function parseVideoUrl(url: string): { platform: "youtube" | "vimeo"; id: string; embed: string; thumb: string } | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (yt) { const id = yt[1]; return { platform: "youtube", id, embed: `https://www.youtube.com/embed/${id}`, thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }; }
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) { const id = vm[1]; return { platform: "vimeo", id, embed: `https://player.vimeo.com/video/${id}`, thumb: "" }; }
  return null;
}
