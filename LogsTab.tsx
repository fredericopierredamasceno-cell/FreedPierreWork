import type { ReactNode } from "react";
import { Zap, CheckCheck, XCircle, AlertCircle, ScrollText } from "lucide-react";
import type { LogEntry } from "../lib/types";
export function LogsTab({ logs }: { logs: LogEntry[] }) {
  const icons: Record<LogEntry["level"], ReactNode> = { info: <Zap size={9} />, success: <CheckCheck size={9} className="text-green-400" />, error: <XCircle size={9} className="text-red-400" />, warn: <AlertCircle size={9} className="text-amber-400" /> };
  const colors: Record<LogEntry["level"], string> = { info: "text-muted-foreground", success: "text-green-400", error: "text-red-400", warn: "text-amber-400" };
  return (
    <div className="space-y-3">
      <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">{logs.length} eventos</div>
      {logs.length === 0
        ? <div className="border border-dashed border-border py-12 text-center"><ScrollText size={18} className="text-muted-foreground mx-auto mb-2" /><p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Nenhum evento</p></div>
        : <div className="border border-border divide-y divide-border">{logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="mt-0.5 flex-shrink-0 text-muted-foreground">{icons[log.level]}</div>
              <span className={`flex-1 text-xs font-light leading-relaxed ${colors[log.level]}`}>{log.msg}</span>
              <span className="font-mono text-[9px] text-muted-foreground/50 flex-shrink-0">{log.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
          ))}</div>}
    </div>
  );
}
