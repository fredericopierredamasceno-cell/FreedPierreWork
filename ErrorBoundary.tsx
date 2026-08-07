import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { RefreshCw } from "lucide-react";
export interface EBState { error: Error | null }
export class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error("ErrorBoundary:", e, info); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full border border-red-500/30 bg-red-500/5 p-8">
          <div className="font-mono text-[10px] text-red-400 tracking-widest uppercase mb-3">Erro do Sistema</div>
          <h1 className="text-4xl font-black uppercase text-foreground mb-4 leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Algo<br /><span className="text-red-400">quebrou.</span></h1>
          <div className="border border-red-500/20 bg-background p-3 mb-5 overflow-auto max-h-32">
            <code className="font-mono text-[10px] text-red-300/70 break-all">{error.message}</code>
          </div>
          <button onClick={() => window.location.reload()} className="flex items-center gap-2 bg-primary text-background px-4 py-2.5 font-bold text-xs tracking-widest uppercase"><RefreshCw size={12} /> Recarregar</button>
        </div>
      </div>
    );
  }
}
