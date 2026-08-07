import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Github, ShieldCheck } from "lucide-react";
import type { GitHubConfig, CMSData, SaveStatus } from "../lib/types";
import { useState } from "react";

export function GitHubConfigTab({ ghConfig, onPublish, onSync, cms, saveStatus, saveError }: {
  ghConfig: GitHubConfig | null; onSave: (cfg: GitHubConfig) => void; onClear: () => void;
  onPublish: () => void; onSync: () => Promise<boolean>; cms: CMSData; saveStatus: SaveStatus; saveError: string;
}) {
  const [syncing, setSyncing] = useState(false); const [synced, setSynced] = useState<boolean | null>(null);
  return <div className="space-y-4">
    <div className="border border-green-500/20 bg-green-500/5 p-4 text-xs text-green-300/80 font-light space-y-1"><div className="flex gap-2 items-center font-mono text-[10px] text-green-400 uppercase tracking-widest mb-2"><ShieldCheck size={13} />Integração protegida</div><p>O navegador não recebe nem armazena token do GitHub.</p><p>Publicações são autorizadas pelo Supabase e executadas pela função segura da Vercel.</p></div>
    <div className="border border-primary/20 bg-primary/5 p-4"><div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-1">Sincronizar conteúdo</div><p className="text-xs text-muted-foreground font-light mb-3">Recarrega o conteúdo publicado, sem expor credenciais.</p><button onClick={async () => { setSyncing(true); setSynced(await onSync()); setSyncing(false); }} disabled={syncing} className="flex items-center gap-2 px-4 py-2.5 font-bold text-xs tracking-widest uppercase border border-primary text-primary hover:bg-primary hover:text-background">{syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}Sincronizar</button>{synced !== null && <p className={`mt-2 font-mono text-[10px] ${synced ? "text-green-400" : "text-red-400"}`}>{synced ? "Atualizado." : "Falha na sincronização."}</p>}</div>
    <div className="border border-border p-4"><div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-2">Publicar</div><p className="text-xs text-muted-foreground font-light mb-3">Salva os dados na área de conteúdo protegida do repositório.</p><button onClick={onPublish} disabled={saveStatus === "saving"} className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 font-bold text-xs tracking-widest uppercase disabled:opacity-50">{saveStatus === "saving" ? <Loader2 size={12} className="animate-spin" /> : <Github size={12} />}Publicar agora</button>{saveStatus === "success" && <p className="mt-2 flex gap-1 text-green-400 font-mono text-[10px]"><CheckCircle2 size={11} />Publicado.</p>}{saveStatus === "error" && <p className="mt-2 flex gap-1 text-red-400 font-mono text-[10px]"><AlertCircle size={11} />{saveError}</p>}</div>
    <div className="border border-border p-4 font-mono text-[10px] text-muted-foreground"><div className="text-primary uppercase tracking-widest mb-2">Status</div><div>{cms.projects.length} projeto(s) · {cms.audios.length} faixa(s) · servidor {ghConfig ? "protegido" : "não configurado"}</div></div>
  </div>;
}
