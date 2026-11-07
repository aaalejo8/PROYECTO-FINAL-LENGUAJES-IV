import { forwardRef, useId } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cx } from '../utils';

// ───────────────────────────── Botón ─────────────────────────────

const VARIANTES = {
  primario: 'bg-primary text-on-primary hover:bg-primary-hover font-semibold',
  secundario: 'border border-line-strong bg-transparent text-ink hover:border-primary hover:text-primary',
  suave: 'bg-surface-3 text-ink hover:bg-line',
  fantasma: 'text-ink-2 hover:bg-surface-3 hover:text-ink',
  peligro: 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
};
const TAMANOS = { sm: 'px-3 py-1.5 text-sm', md: 'px-5 py-2.5 text-[0.95rem]', lg: 'px-7 py-3.5 text-base' };

export const Boton = forwardRef(function Boton({ variante = 'primario', tamano = 'md', cargando = false, icono: Icono, className, children, disabled, type = 'button', ...resto }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variante],
        TAMANOS[tamano],
        className
      )}
      {...resto}
    >
      {cargando ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : Icono ? <Icono size={18} aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

/** Link con aspecto de botón (usa el mismo estilo). */
export const estiloBoton = (variante = 'primario', tamano = 'md', extra = '') =>
  cx('inline-flex select-none items-center justify-center gap-2 rounded-md transition-colors', VARIANTES[variante], TAMANOS[tamano], extra);

// ───────────────────────────── Campos de formulario ─────────────────────────────

const BASE_INPUT =
  'w-full rounded-md border bg-surface-1 px-3.5 py-2.5 text-ink placeholder:text-ink-3 transition-colors focus:border-primary focus:outline-none focus-visible:shadow-focus disabled:opacity-60';

export function Campo({ etiqueta, error, ayuda, opcional = false, children, className }) {
  const id = useId();
  const hijo = typeof children === 'function' ? children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined }) : children;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink">
        <span>{etiqueta}</span>
        {opcional && <span className="text-xs font-normal text-ink-3">Opcional</span>}
      </label>
      {hijo}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger" role="alert">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : ayuda ? (
        <p id={`${id}-ayuda`} className="mt-1.5 text-xs text-ink-3">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

export const Entrada = forwardRef(function Entrada({ error, className, ...resto }, ref) {
  return <input ref={ref} className={cx(BASE_INPUT, error ? 'border-danger' : 'border-line', className)} {...resto} />;
});

export const AreaTexto = forwardRef(function AreaTexto({ error, className, rows = 5, ...resto }, ref) {
  return <textarea ref={ref} rows={rows} className={cx(BASE_INPUT, 'resize-y', error ? 'border-danger' : 'border-line', className)} {...resto} />;
});

export const Seleccion = forwardRef(function Seleccion({ error, className, children, ...resto }, ref) {
  return (
    <select ref={ref} className={cx(BASE_INPUT, 'appearance-none bg-no-repeat pr-9', error ? 'border-danger' : 'border-line', className)} {...resto}>
      {children}
    </select>
  );
});

export function Interruptor({ etiqueta, activo, onChange, ayuda }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={activo}
        onClick={() => onChange(!activo)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors', activo ? 'bg-primary' : 'bg-line')}
      >
        <span className={cx('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface-0 transition-transform', activo && 'translate-x-5')} />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm text-ink">
        {etiqueta}
        {ayuda && <span className="block text-xs text-ink-3">{ayuda}</span>}
      </label>
    </div>
  );
}

// ───────────────────────────── Piezas visuales ─────────────────────────────

const TONOS = {
  neutro: 'border-line bg-surface-3 text-ink-2',
  primario: 'border-primary/40 bg-primary/10 text-primary',
  secundario: 'border-secondary/40 bg-secondary/10 text-secondary',
  acento: 'border-accent/50 bg-accent/10 text-ink',
  ok: 'border-success/40 bg-success/10 text-success',
  aviso: 'border-warning/40 bg-warning/10 text-warning',
  error: 'border-danger/40 bg-danger/10 text-danger',
  info: 'border-info/40 bg-info/10 text-info',
};

export function Insignia({ tono = 'neutro', mono = false, className, children }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5', mono && 'font-mono', TONOS[tono], className)}>
      {children}
    </span>
  );
}

export function Tarjeta({ className, children, ...resto }) {
  return (
    <div className={cx('rounded-lg border border-line bg-surface-2', className)} {...resto}>
      {children}
    </div>
  );
}

export function Cargando({ texto = 'Cargando…', className }) {
  return (
    <div className={cx('flex items-center justify-center gap-2 py-12 text-ink-2', className)} role="status">
      <Loader2 size={20} className="animate-spin" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function BloqueError({ mensaje, onReintentar }) {
  return (
    <div className="mx-auto max-w-md rounded-md border border-danger/40 bg-danger/10 p-6 text-center" role="alert">
      <AlertTriangle className="mx-auto mb-2 text-danger" size={28} aria-hidden="true" />
      <p className="text-ink">{mensaje}</p>
      {onReintentar && (
        <Boton variante="secundario" tamano="sm" className="mt-4" onClick={onReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

export function Vacio({ icono: Icono, titulo, children }) {
  return (
    <div className="px-4 py-12 text-center">
      {Icono && <Icono className="mx-auto mb-3 text-ink-3" size={36} aria-hidden="true" />}
      <p className="font-display text-lg font-semibold text-ink">{titulo}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">{children}</p>}
    </div>
  );
}

export function EncabezadoSeccion({ etiqueta, titulo, children, className }) {
  return (
    <div className={cx('mb-10 max-w-2xl', className)} data-reveal>
      <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">{etiqueta}</p>
      <h2 className="text-3xl font-semibold sm:text-4xl">{titulo}</h2>
      {children && <p className="mt-4 text-lg text-ink-2">{children}</p>}
    </div>
  );
}

export function Paginacion({ pagina, paginas, onCambiar }) {
  if (paginas <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-2">
      <Boton variante="fantasma" tamano="sm" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
        ← Anterior
      </Boton>
      <span>
        Página {pagina} de {paginas}
      </span>
      <Boton variante="fantasma" tamano="sm" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>
        Siguiente →
      </Boton>
    </div>
  );
}
