import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { ADMIN_USER, ADMIN_PASS, MAX_LOGIN_ATTEMPTS, LOGIN_LOCK_MS, startSession, getLoginFailState, setLoginFailState, clearLoginFailState } from "../lib/session";
export function AdminLoginModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [user, setUser] = useState(""); const [pass, setPass] = useState(""); const [showPass, setShowPass] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { if (!open) { setUser(""); setPass(""); setErr(""); } }, [open]);
  const submit = () => {
    const failState = getLoginFailState();
    if (failState.lockUntil > Date.now()) {
      const secs = Math.ceil((failState.lockUntil - Date.now()) / 1000);
      setErr(`Muitas tentativas incorretas. Aguarde ${secs}s.`);
      return;
    }
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      clearLoginFailState();
      startSession();
      onSuccess(); onClose();
    } else {
      const nextCount = failState.count + 1;
      if (nextCount >= MAX_LOGIN_ATTEMPTS) {
        setLoginFailState({ count: 0, lockUntil: Date.now() + LOGIN_LOCK_MS });
        setErr(`Muitas tentativas incorretas. Aguarde ${Math.round(LOGIN_LOCK_MS / 1000)}s.`);
      } else {
        setLoginFailState({ count: nextCount, lockUntil: 0 });
        setErr("Usuário ou senha incorretos.");
      }
    }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div><div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">Admin</div><h2 className="text-2xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Entrar</h2></div>
          <Lock size={18} className="text-muted-foreground" />
        </div>
        <div className="p-6 space-y-4">
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Usuário</label><input value={user} onChange={e => setUser(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" autoComplete="username" /></div>
          <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Senha</label>
            <div className="relative"><input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} className="w-full bg-muted border border-border px-4 py-3 pr-11 text-sm text-foreground focus:outline-none focus:border-primary" autoComplete="current-password" />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPass ? <Eye size={15} /> : <EyeOff size={15} />}</button>
            </div>
          </div>
          {err && <p className="font-mono text-[10px] text-red-400">{err}</p>}
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Cancelar</button>
          <button onClick={submit} className="flex items-center gap-2 bg-primary text-background px-6 py-2.5 font-bold text-xs tracking-widest uppercase"><Lock size={12} /> Entrar</button>
        </div>
      </div>
    </div>
  );
}
