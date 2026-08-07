import { X, Check, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Casca genérica de modal de edição.
 * Usada por EditAudioModal, EditProjectModal (vídeo/imagem/embed) e qualquer
 * futuro editor de categoria — evita duplicar header/backdrop/rodapé em cada um.
 */
export function EditModalShell({
  eyebrow, title, onClose, canSave, busy, done, onSave, children, extraHeaderAction,
}: {
  eyebrow: string; title: string;
  onClose: () => void;
  canSave: boolean; busy: boolean; done: boolean;
  onSave: () => void;
  children: ReactNode;
  extraHeaderAction?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">{eyebrow}</div>
            <h2 className="text-xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {extraHeaderAction}
            <button onClick={onClose} className="w-8 h-8 border border-border flex items-center justify-center text-muted-foreground"><X size={14} /></button>
          </div>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          {children}
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="font-mono text-xs text-muted-foreground tracking-widest uppercase">Cancelar</button>
          <button onClick={onSave} disabled={!canSave || busy} className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs tracking-widest uppercase transition-all ${done ? "bg-green-600 text-white" : "bg-primary text-background disabled:opacity-50"}`}>
            {done ? <><Check size={12} />Salvo!</> : busy ? <><Loader2 size={12} className="animate-spin" />Salvando...</> : <><Check size={12} />Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
