import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { requireSupabase } from "../lib/supabase";

export function AdminLoginModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const recoveryMode = window.location.hash.includes("recovery") || window.location.hash.includes("admin-reset") || window.location.search.includes("recovery");
  useEffect(() => { if (!open) { setPassword(""); setMessage(""); } }, [open]);
  const submit = async () => {
    setBusy(true); setMessage("");
    try {
      const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      onSuccess(); onClose();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível entrar."); }
    finally { setBusy(false); }
  };
  const resetPassword = async () => {
    if (!email.trim()) { setMessage("Informe seu e-mail para receber o link de recuperação."); return; }
    setBusy(true); setMessage("");
    try {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/#admin-reset` });
      if (error) throw error;
      setMessage("Enviamos um link seguro para redefinir sua senha.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível solicitar a recuperação."); }
    finally { setBusy(false); }
  };
  const updatePassword = async () => {
    if (password.length < 8) { setMessage("Use uma senha com pelo menos 8 caracteres."); return; }
    setBusy(true); setMessage("");
    try { const { error } = await requireSupabase().auth.updateUser({ password }); if (error) throw error; window.history.replaceState({}, "", window.location.pathname); setMessage("Senha atualizada. Você já pode entrar."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a senha."); }
    finally { setBusy(false); }
  };
  if (!open) return null;
  return <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-background/92 backdrop-blur-sm" onClick={onClose} />
    <div className="relative z-10 w-full max-w-sm bg-card border border-border">
      <div className="px-6 py-5 border-b border-border flex items-center justify-between"><div><div className="font-mono text-[10px] text-primary tracking-widest uppercase mb-0.5">Admin</div><h2 className="text-2xl font-black uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{recoveryMode ? "Nova senha" : "Entrar"}</h2></div><Lock size={18} className="text-muted-foreground" /></div>
      <div className="p-6 space-y-4">
        {!recoveryMode && <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">E-mail</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} className="w-full bg-muted border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" autoComplete="email" /></div>}
        <div><label className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase block mb-2">Senha</label><div className="relative"><input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} className="w-full bg-muted border border-border px-4 py-3 pr-11 text-sm text-foreground focus:outline-none focus:border-primary" autoComplete="current-password" /><button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPass ? <Eye size={15} /> : <EyeOff size={15} />}</button></div></div>
        {!recoveryMode && <button type="button" onClick={resetPassword} disabled={busy} className="font-mono text-[10px] text-primary hover:underline">Esqueci minha senha</button>}
        {message && <p className="font-mono text-[10px] text-muted-foreground">{message}</p>}
      </div>
      <div className="px-6 py-4 border-t border-border flex items-center justify-between"><button onClick={onClose} className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Cancelar</button><button onClick={recoveryMode ? updatePassword : submit} disabled={busy || !password || (!recoveryMode && !email)} className="flex items-center gap-2 bg-primary text-background px-6 py-2.5 font-bold text-xs tracking-widest uppercase disabled:opacity-50">{busy ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}{recoveryMode ? "Atualizar" : "Entrar"}</button></div>
    </div>
  </div>;
}
