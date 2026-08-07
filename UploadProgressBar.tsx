import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { UploadProgress } from "../lib/types";
import { PHASE_LABELS, fmtETA, fmtBytes, fmtSpeed } from "../lib/format";
export function UploadProgressBar({ progress }: { progress: UploadProgress | null }) {
  if (!progress) return null;
  const color = progress.phase === "error" ? "bg-red-500" : progress.phase === "done" ? "bg-green-500" : "bg-primary";
  const textColor = progress.phase === "error" ? "text-red-400" : progress.phase === "done" ? "text-green-400" : "text-primary";
  return (
    <div className="space-y-2 border border-border p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className={`font-mono text-[10px] tracking-widest uppercase ${textColor} flex items-center gap-1.5`}>
          {progress.phase === "sending" && <Loader2 size={9} className="animate-spin" />}
          {progress.phase === "done" && <CheckCircle2 size={9} />}
          {progress.phase === "error" && <XCircle size={9} />}
          {PHASE_LABELS[progress.phase]}
          {progress.phase === "sending" && progress.eta > 0 && <span className="text-muted-foreground ml-1">{fmtETA(progress.eta)}</span>}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{progress.percent.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground tabular-nums">
        <span>{fmtBytes(progress.bytesSent)} / {fmtBytes(progress.bytesTotal)}</span>
        {progress.speed > 0 && <span>{fmtSpeed(progress.speed)}</span>}
      </div>
    </div>
  );
}
