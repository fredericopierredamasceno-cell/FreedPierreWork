import type { ChangeEvent, ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/* ═══════════════════════════════════════════════════════════════════
   Design system do Admin — peça 1: campo de formulário.

   Mesmo visual que já existia espalhado (repetido) por AdminPanel,
   GitHubConfigTab, etc — só que agora com uma única fonte de verdade.
   Trocar o estilo de TODOS os campos do admin passa a ser: editar aqui.
═══════════════════════════════════════════════════════════════════ */

const fieldBaseClass =
  "w-full bg-muted border border-border px-3 py-2 text-sm text-foreground " +
  "transition-colors duration-150 focus:outline-none focus:border-primary";

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] text-muted-foreground uppercase block mb-1">
        {label}
        {required
          ? <span className="text-primary ml-1" title="Obrigatório">*</span>
          : <span className="text-muted-foreground/50 normal-case ml-1.5 tracking-normal">(opcional)</span>}
      </label>
      {children}
      {hint && <p className="font-mono text-[9px] text-muted-foreground/60 mt-1">{hint}</p>}
    </div>
  );
}

export function FieldInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <input value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} className={fieldBaseClass} {...rest} />;
}

export function FieldTextarea({ value, onChange, rows = 3, ...rest }: { value: string; onChange: (v: string) => void; rows?: number } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "rows">) {
  return <textarea value={value} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)} rows={rows} className={`${fieldBaseClass} resize-none`} {...rest} />;
}

/** Combina Field + Input/Textarea num só componente, para o caso comum
 *  (label simples + 1 campo). Cobre a maioria dos usos no admin hoje. */
export function TextField({ label, value, onChange, multiline, rows, required, hint, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; rows?: number; required?: boolean; hint?: string; placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint} required={required}>
      {multiline
        ? <FieldTextarea value={value} onChange={onChange} rows={rows} placeholder={placeholder} />
        : <FieldInput value={value} onChange={onChange} placeholder={placeholder} />}
    </Field>
  );
}
