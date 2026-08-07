import { Eye, EyeOff } from "lucide-react";

/**
 * Botão "Publicar / Ocultar" reutilizado por todas as categorias de conteúdo
 * (vídeos, imagens, motion, design gráfico, áudios e futuras categorias).
 * Ocultar nunca apaga o item — apenas remove da exibição pública; o item
 * continua salvo no CMS e pode ser reativado a qualquer momento.
 */
export function VisibilityToggleButton({ hidden, onToggle, size = 8 }: {
  hidden: boolean; onToggle: () => void; size?: number;
}) {
  return (
    <button
      onClick={onToggle}
      title={hidden ? "Publicar (mostrar no site)" : "Ocultar (manter salvo, remover do site)"}
      className={`font-mono text-[9px] px-2 py-1 border transition-colors ${hidden ? "border-green-500/40 text-green-400" : "border-yellow-500/40 text-yellow-400"}`}
    >
      {hidden ? <Eye size={size} /> : <EyeOff size={size} />}
    </button>
  );
}

export function VisibilityBadge({ hidden }: { hidden: boolean }) {
  if (!hidden) return null;
  return <span className="font-mono text-[8px] px-1 bg-red-500/20 text-red-400 uppercase">Oculto</span>;
}
