import { t } from "@/i18n/es";
import { cx } from "@/lib/format";
import { useConnectionStore, type ConnectionStatus } from "@/stores/connection";

const dot: Record<ConnectionStatus, string> = {
  starting: "bg-gold animate-[fw-pulse_1.2s_ease-in-out_infinite]",
  connected: "bg-ok",
  disconnected: "bg-faint animate-[fw-pulse_1.2s_ease-in-out_infinite]",
  error: "bg-danger",
  closing: "bg-gold",
};

const text: Record<ConnectionStatus, string> = {
  starting: "text-gold",
  connected: "text-ok",
  disconnected: "text-muted",
  error: "text-danger",
  closing: "text-gold",
};

/** Indicador permanente del estado de la conexión entre la interfaz y el backend. */
export function ConnectionIndicator({ compact = false, primary = false }: { compact?: boolean; primary?: boolean }) {
  const status = useConnectionStore((s) => s.status);
  const detail = useConnectionStore((s) => s.detail);
  const description = detail ?? t.connection.description[status];
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={primary ? "connection-indicator" : undefined}
      data-status={status}
      title={description}
      className="flex items-center gap-2.5"
    >
      <span className={cx("size-2 shrink-0 rounded-full", dot[status])} aria-hidden />
      <span className="min-w-0 leading-tight">
        {compact ? null : <span className="block text-[11px] text-faint">{t.connection.label}</span>}
        <span className={cx("block text-[13px] font-semibold", text[status])}>
          <span className="sr-only">{t.connection.label}: </span>
          {t.connection.status[status]}
        </span>
      </span>
    </div>
  );
}
