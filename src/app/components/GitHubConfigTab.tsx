import { useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Eye, EyeOff, Check } from "lucide-react";
import type { GitHubConfig, CMSData, SaveStatus } from "../lib/types";
import { ghTestConnection } from "../lib/github";
import { PublishReviewModal } from "./PublishReviewModal";
export function GitHubConfigTab({ ghConfig, onSave, onClear, onPublish, onSync, cms, saveStatus, saveError }: {
  ghConfig: GitHubConfig | null; onSave: (cfg: GitHubConfig) => void; onClear: () => void;
  onPublish: () => void; onSync: () => Promise<boolean>; cms: CMSData; saveStatus: SaveStatus; saveError: string;
}) {
  const [owner, setOwner] = useState(ghConfig?.owner ?? "");
  const [repo, setRepo] = useState(ghConfig?.repo ?? "");
  const [branch, setBranch] = useState(ghConfig?.branch ?? "main");
  const [token, setToken] = useState(ghConfig?.token ?? "");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<boolean | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const configComplete = !!ghConfig && !!ghConfig.token;

  return (
    <div className="space-y-4">
      {/* Architecture note */}
      <div className="border border-green-500/20 bg-green-500/5 p-4 text-xs text-green-300/80 font-light space-y-1">
        <div className="font-mono text-[10px] text-green-400 uppercase tracking-widest mb-2">Arquitetura Segura</div>
        <p>Conteúdo salvo em <code className="text-green-300">cms/data.json</code> — fora do <code className="text-green-300">public/</code>.</p>
        <p>Commits do Figma Make <strong>nunca sobrescrevem</strong> este arquivo. Apenas o admin pode alterar.</p>
        <p>Uploads em <code className="text-green-300">public/uploads/</code> também são preservados.</p>
      </div>

      {/* Sync */}
      <div className="border border-primary/20 bg-primary/5 p-4">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-1">Sincronizar do GitHub</div>
        <p className="text-xs text-muted-foreground font-light mb-3">Recarrega o CMS do repositório. Use sempre após um commit via Figma.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={async () => { setSyncing(true); setSyncResult(null); const ok = await onSync(); setSyncResult(ok); setSyncing(false); setTimeout(() => setSyncResult(null), 4000); }} disabled={!ghConfig?.owner || syncing} className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs tracking-widest uppercase border transition-all ${!ghConfig?.owner ? "border-border text-muted-foreground opacity-50 cursor-not-allowed" : "border-primary text-primary hover:bg-primary hover:text-background"}`}>
            {syncing ? <><Loader2 size={12} className="animate-spin" />Sincronizando...</> : <><RefreshCw size={12} />Sincronizar</>}
          </button>
          {syncResult === true && <span className="flex items-center gap-1.5 font-mono text-[10px] text-green-400"><CheckCircle2 size={11} />Atualizado!</span>}
          {syncResult === false && <span className="flex items-center gap-1.5 font-mono text-[10px] text-red-400"><AlertCircle size={11} />Falha</span>}
        </div>
      </div>

      {/* Publish */}
      <div className="border border-border p-4">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-2">Publicar → GitHub → Vercel</div>
        <p className="text-xs text-muted-foreground font-light mb-3">Salva em <code>cms/data.json</code>. Vercel faz deploy automaticamente.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setReviewOpen(true)} disabled={!configComplete || saveStatus === "saving"} className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs tracking-widest uppercase transition-all ${!configComplete ? "bg-muted text-muted-foreground cursor-not-allowed" : saveStatus === "saving" ? "bg-primary/60 text-background" : "bg-primary text-background"}`}>
            {saveStatus === "saving" ? <><Loader2 size={12} className="animate-spin" />Publicando...</> : <><Eye size={12} />Revisar e publicar</>}
          </button>
          {saveStatus === "success" && <span className="flex items-center gap-1.5 font-mono text-[10px] text-green-400"><CheckCircle2 size={11} />Publicado! ~2 min...</span>}
          {saveStatus === "error" && saveError && <span className="font-mono text-[10px] text-red-400 max-w-[200px] flex items-center gap-1"><AlertCircle size={11} />{saveError}</span>}
        </div>
      </div>

      {/* Config */}
      <div className="border border-border p-4 space-y-3">
        <div className="font-mono text-[10px] text-primary tracking-widest uppercase">Configuração do Repositório</div>
        {ghConfig && <div className="flex items-center gap-2 text-[10px] font-mono"><span className={`w-2 h-2 rounded-full ${configComplete ? "bg-green-500" : "bg-amber-500"}`} /><span className="text-muted-foreground">{ghConfig.owner}/{ghConfig.repo} ({ghConfig.branch})</span></div>}
        <div className="grid grid-cols-2 gap-2">
          <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Usuário / Org</label><input value={owner} onChange={e => setOwner(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Repositório</label><input value={repo} onChange={e => setRepo(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
        </div>
        <div><label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Branch</label><input value={branch} onChange={e => setBranch(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">Token (PAT) — só nesta sessão</label>
          <div className="relative"><input type={showToken ? "text" : "password"} value={token} onChange={e => setToken(e.target.value)} className="w-full bg-muted border border-border px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:border-primary" />
            <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showToken ? <Eye size={14} /> : <EyeOff size={14} />}</button>
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/50 mt-1">owner/repo/branch → localStorage. Token → sessionStorage (apaga ao fechar).</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={async () => { setTesting(true); setTestResult(null); const r = await ghTestConnection({ owner, repo, branch, token }); setTestResult(r); setTesting(false); }} disabled={!owner || !repo || !token || testing} className="flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
            {testing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}Testar
          </button>
          <button onClick={() => onSave({ owner, repo, branch, token })} disabled={!owner || !repo || !token} className="flex items-center gap-2 bg-primary text-background px-4 py-2 font-bold text-[10px] tracking-widest uppercase disabled:opacity-50">
            <Check size={10} />Salvar
          </button>
          {ghConfig && <button onClick={onClear} className="font-mono text-[10px] text-red-400 tracking-widest uppercase">Limpar</button>}
        </div>
        {testResult && <div className={`flex items-center gap-2 font-mono text-[10px] ${testResult.ok ? "text-green-400" : "text-red-400"}`}>{testResult.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}{testResult.ok ? `Conectado: ${testResult.name}` : testResult.error}</div>}
      </div>

      <div className="border border-border p-4 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary uppercase tracking-widest mb-2">Status</div>
        <div>{cms.projects.length} projeto(s) · {cms.audios.length} faixa(s) · {new Date(cms.updatedAt).toLocaleString("pt-BR")}</div>
      </div>

      <PublishReviewModal
        cms={cms}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        publishing={saveStatus === "saving"}
        onConfirm={() => { onPublish(); setReviewOpen(false); }}
      />
    </div>
  );
}
