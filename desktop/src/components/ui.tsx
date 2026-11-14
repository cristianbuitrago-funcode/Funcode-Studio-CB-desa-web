// Componentes de interfaz básicos y reutilizables. Sin lógica de negocio.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useEffect, useId, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { cx } from "@/lib/format";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-blue text-on-accent hover:bg-blue-2 shadow-[0_8px_24px_-12px_var(--fw-blue)] disabled:bg-surface-2 disabled:text-faint disabled:shadow-none",
  secondary:
    "border border-line-strong bg-surface text-text hover:bg-surface-2 disabled:text-faint disabled:hover:bg-surface",
  ghost: "text-muted hover:bg-surface-2 hover:text-text disabled:text-faint disabled:hover:bg-transparent",
  danger:
    "border border-danger/50 text-danger hover:bg-danger/10 disabled:border-line disabled:text-faint disabled:hover:bg-transparent",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  busy?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "secondary", busy, icon, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold transition-colors",
        buttonStyles[variant],
        className,
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("rounded-2xl border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">{children}</h2>
      {action}
    </div>
  );
}

type BadgeTone = "neutral" | "blue" | "ok" | "gold" | "danger";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-line-strong text-muted",
  blue: "border-blue/50 text-blue-soft bg-blue/10",
  ok: "border-ok/40 text-ok bg-ok/10",
  gold: "border-gold/40 text-gold bg-gold/10",
  danger: "border-danger/40 text-danger bg-danger/10",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  );
}

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-text">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputStyles =
  "w-full rounded-lg border border-line-strong bg-bg-2 px-3 text-sm text-text placeholder:text-faint transition-colors focus:border-blue-2 focus:outline-none aria-[invalid=true]:border-danger disabled:opacity-60";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputStyles, "h-10", className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputStyles, "min-h-32 resize-y py-2.5 leading-relaxed", className)} />;
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-6 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function Notice({
  tone = "danger",
  title,
  children,
  action,
}: {
  tone?: "danger" | "gold" | "blue";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    danger: "border-danger/40 bg-danger/[0.07]",
    gold: "border-gold/40 bg-gold/[0.07]",
    blue: "border-blue/40 bg-blue/[0.07]",
  };
  const iconTones = { danger: "text-danger", gold: "text-gold", blue: "text-blue-soft" };
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cx("flex gap-3 rounded-xl border p-4", tones[tone])}>
      <AlertTriangle className={cx("mt-0.5 size-4 shrink-0", iconTones[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">{title}</p>
        {children ? <div className="mt-1 text-[13px] text-muted">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon ? (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-line-strong bg-surface-2 text-blue-soft">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children ? <div className="mt-2 max-w-md text-[13px] text-muted">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Marca una función como todavía no disponible. Nunca es interactiva. */
export function PhaseTag({ phase }: { phase: number | string }) {
  return <Badge tone="gold">Fase {phase}</Badge>;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="text-[26px] font-bold break-words">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, title, onClose, children, footer }: DialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Referencia estable: el foco inicial solo debe fijarse al abrir, no en cada actualización.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    (focusable().find((el) => el.hasAttribute("data-autofocus")) ?? focusable()[0] ?? panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl border border-line-strong bg-surface shadow-2xl"
      >
        <h2 id={titleId} className="border-b border-line px-6 py-4 text-lg font-semibold">
          {title}
        </h2>
        <div className="px-6 py-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export function DefinitionList({ items }: { items: Array<[label: string, value: ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[minmax(120px,max-content)_1fr] gap-x-6 gap-y-2.5 text-[13px]">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-faint">{label}</dt>
          <dd className="min-w-0 break-words text-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
