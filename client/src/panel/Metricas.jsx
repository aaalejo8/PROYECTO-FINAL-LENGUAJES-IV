import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, LogIn, MessageSquare, UserPlus, Users } from 'lucide-react';
import { api } from '../api';
import { useContador } from '../animaciones';
import { BloqueError, Campo, Cargando, Entrada, Seleccion, Tarjeta } from '../componentes/ui';
import { cx, diaIso } from '../utils';
import Grafico, { COLORES } from './Grafico';
import { ESTADOS, TIPOS } from './Consultas';

function Contador({ icono: Icono, titulo, valor, detalle, tono = 'text-primary' }) {
  const [n, ref] = useContador(valor ?? 0, { duracion: 1 });
  return (
    <Tarjeta className="p-5">
      <div ref={ref} className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-2">{titulo}</p>
          <p className="mt-1 font-display text-3xl font-semibold">{n.toLocaleString('es-AR')}</p>
          {detalle && <p className="mt-1 text-xs text-ink-3">{detalle}</p>}
        </div>
        <Icono size={22} className={tono} aria-hidden="true" />
      </div>
    </Tarjeta>
  );
}

const PRESETS = [
  ['7 días', 6, 'day'],
  ['30 días', 29, 'day'],
  ['90 días', 89, 'week'],
  ['12 meses', 364, 'month'],
];

const dias = (desde, hasta) => Math.round((new Date(`${hasta}T00:00:00Z`) - new Date(`${desde}T00:00:00Z`)) / 86_400_000);

function etiquetaPeriodo(periodo, agrupar) {
  const [a, m, d] = periodo.split('-');
  if (agrupar === 'month') return `${m}/${a}`;
  if (agrupar === 'week') return `Sem. ${d}/${m}`;
  return `${d}/${m}`;
}

const ejes = {
  x: { grid: { display: false } },
  y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#2a355655' } },
};

export default function Metricas() {
  const [resumen, setResumen] = useState(null);
  const [rango, setRango] = useState({ desde: diaIso(29), hasta: diaIso(0), agrupar: 'day', tipo: '' });
  const [series, setSeries] = useState(null);
  const [porTipo, setPorTipo] = useState(null);
  const [error, setError] = useState('');
  const [errorRango, setErrorRango] = useState('');

  useEffect(() => {
    api.metricas.resumen().then(setResumen).catch((e) => setError(e.message));
  }, []);

  const cargar = useCallback(async () => {
    const d = dias(rango.desde, rango.hasta);
    if (!rango.desde || !rango.hasta || Number.isNaN(d)) return setErrorRango('Elegí las dos fechas.');
    if (d < 0) return setErrorRango('La fecha "desde" no puede ser posterior a "hasta".');
    if (d > 730) return setErrorRango('El rango máximo es de 2 años.');
    if (rango.agrupar === 'day' && d > 180) return setErrorRango('Para más de 180 días agrupá por semana o por mes.');
    setErrorRango('');
    try {
      const [s, t] = await Promise.all([api.metricas.series(rango), api.metricas.consultas({ desde: rango.desde, hasta: rango.hasta, tipo: rango.tipo })]);
      setSeries(s.puntos);
      setPorTipo(t);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [rango]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const elegirPreset = ([, atras, agrupar]) => setRango((r) => ({ ...r, desde: diaIso(atras), hasta: diaIso(0), agrupar }));

  const datosLinea = useMemo(() => {
    if (!series) return null;
    const etiquetas = series.map((p) => etiquetaPeriodo(p.periodo, rango.agrupar));
    const serie = (label, campo, color, relleno = false) => ({
      label,
      data: series.map((p) => p[campo]),
      borderColor: color,
      backgroundColor: `${color}22`,
      fill: relleno,
      tension: 0.3,
      pointRadius: series.length > 45 ? 0 : 3,
      pointHoverRadius: 6,
      borderWidth: 2,
    });
    return {
      labels: etiquetas,
      datasets: [
        serie('Visitas', 'visitas', COLORES.primario, true),
        serie('Visitantes únicos', 'visitantes', COLORES.secundario),
        serie('Visitas con sesión iniciada', 'visitas_autenticadas', COLORES.info),
        serie('Accesos autenticados', 'accesos', COLORES.acento),
      ],
    };
  }, [series, rango.agrupar]);

  const datosRegistros = useMemo(
    () =>
      series && {
        labels: series.map((p) => etiquetaPeriodo(p.periodo, rango.agrupar)),
        datasets: [
          { type: 'bar', label: 'Cuentas nuevas', data: series.map((p) => p.registros), backgroundColor: COLORES.ok, borderRadius: 4, yAxisID: 'y', order: 2 },
          { type: 'line', label: 'Total acumulado', data: series.map((p) => p.usuarios_acumulados), borderColor: COLORES.secundario, backgroundColor: COLORES.secundario, tension: 0.3, pointRadius: series.length > 45 ? 0 : 2, yAxisID: 'y1', order: 1 },
        ],
      },
    [series, rango.agrupar]
  );

  const datosConsultasTiempo = useMemo(
    () =>
      series && {
        labels: series.map((p) => etiquetaPeriodo(p.periodo, rango.agrupar)),
        datasets: [{ label: rango.tipo ? TIPOS[rango.tipo] : 'Consultas', data: series.map((p) => p.consultas), backgroundColor: COLORES.secundario, borderRadius: 4 }],
      },
    [series, rango.agrupar, rango.tipo]
  );

  const datosTipo = useMemo(
    () =>
      porTipo && {
        labels: porTipo.por_tipo.map((f) => TIPOS[f.clave] || f.clave),
        datasets: [{ data: porTipo.por_tipo.map((f) => f.cantidad), backgroundColor: [COLORES.primario, COLORES.secundario, COLORES.acento], borderColor: '#131a2b', borderWidth: 3 }],
      },
    [porTipo]
  );

  const datosEstado = useMemo(
    () =>
      porTipo && {
        labels: porTipo.por_estado.map((f) => ESTADOS[f.clave] || f.clave),
        datasets: [{ label: 'Consultas', data: porTipo.por_estado.map((f) => f.cantidad), backgroundColor: [COLORES.primario, COLORES.aviso, COLORES.ok, '#5b6a94'], borderRadius: 4 }],
      },
    [porTipo]
  );

  if (error && !resumen && !series) return <BloqueError mensaje={error} onReintentar={() => window.location.reload()} />;

  const totalTipo = porTipo ? porTipo.por_tipo.reduce((a, f) => a + f.cantidad, 0) : 0;

  return (
    <div className="space-y-6">
      {resumen ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Contador icono={Eye} titulo="Visitas totales" valor={resumen.visitas_total} detalle={`${resumen.visitas_hoy} hoy · ${resumen.visitantes_hoy} visitantes únicos hoy · ${resumen.visitas_autenticadas} con sesión`} />
          <Contador icono={Users} titulo="Usuarios registrados" valor={resumen.usuarios_registrados} tono="text-success" detalle="Cuentas de visitantes" />
          <Contador icono={LogIn} titulo="Accesos autenticados" valor={resumen.accesos_total} tono="text-accent" detalle={`${resumen.accesos_hoy} hoy · ${resumen.usuarios_con_acceso} usuarios distintos`} />
          <Contador icono={MessageSquare} titulo="Consultas recibidas" valor={resumen.consultas_total} tono="text-secondary" detalle={`${resumen.consultas_nuevas} sin atender`} />
        </div>
      ) : (
        <Cargando />
      )}

      <Tarjeta className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Rangos rápidos">
          {PRESETS.map((p) => {
            const activo = rango.desde === diaIso(p[1]) && rango.hasta === diaIso(0) && rango.agrupar === p[2];
            return (
              <button
                key={p[0]}
                type="button"
                aria-pressed={activo}
                onClick={() => elegirPreset(p)}
                className={cx('rounded-full border px-3.5 py-1.5 text-sm transition-colors', activo ? 'border-primary/60 bg-primary/10 text-primary' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink')}
              >
                {p[0]}
              </button>
            );
          })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Desde">{(p) => <Entrada {...p} type="date" value={rango.desde} max={rango.hasta} onChange={(e) => setRango({ ...rango, desde: e.target.value })} />}</Campo>
          <Campo etiqueta="Hasta">{(p) => <Entrada {...p} type="date" value={rango.hasta} min={rango.desde} max={diaIso(0)} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} />}</Campo>
          <Campo etiqueta="Agrupar por">
            {(p) => (
              <Seleccion {...p} value={rango.agrupar} onChange={(e) => setRango({ ...rango, agrupar: e.target.value })}>
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
              </Seleccion>
            )}
          </Campo>
          <Campo etiqueta="Tipo de consulta">
            {(p) => (
              <Seleccion {...p} value={rango.tipo} onChange={(e) => setRango({ ...rango, tipo: e.target.value })}>
                <option value="">Todos</option>
                {Object.entries(TIPOS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Seleccion>
            )}
          </Campo>
        </div>
        {errorRango && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {errorRango}
          </p>
        )}
        {error && !errorRango && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </Tarjeta>

      {!series ? (
        <Cargando />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Tarjeta className="p-4 sm:p-5 lg:col-span-2">
            <h2 className="mb-1 text-lg font-semibold">Visitas y accesos</h2>
            <p className="mb-4 text-sm text-ink-3">Tocá un nombre de la leyenda para ocultar o mostrar esa línea.</p>
            <Grafico
              tipo="line"
              datos={datosLinea}
              descripcion="Gráfico de líneas con las visitas, visitantes únicos y accesos de usuarios en el período elegido"
              className="h-72 sm:h-80"
              opciones={{ interaction: { mode: 'index', intersect: false }, scales: ejes, plugins: { legend: { position: 'bottom' } } }}
            />
          </Tarjeta>

          <Tarjeta className="p-4 sm:p-5">
            <h2 className="mb-4 text-lg font-semibold">Evolución de usuarios registrados</h2>
            <Grafico
              tipo="bar"
              datos={datosRegistros}
              descripcion="Gráfico combinado con las cuentas creadas por período (barras) y el total acumulado de usuarios registrados (línea)"
              opciones={{
                interaction: { mode: 'index', intersect: false },
                scales: { ...ejes, y1: { position: 'right', beginAtZero: true, ticks: { precision: 0 }, grid: { display: false } } },
                plugins: { legend: { position: 'bottom' } },
              }}
            />
          </Tarjeta>

          <Tarjeta className="p-4 sm:p-5">
            <h2 className="mb-4 text-lg font-semibold">Consultas por tipo</h2>
            {totalTipo === 0 ? (
              <p className="grid h-72 place-items-center text-ink-3">No hubo consultas en este período.</p>
            ) : (
              <Grafico tipo="doughnut" datos={datosTipo} descripcion="Gráfico circular con las consultas recibidas por tipo" opciones={{ cutout: '62%', plugins: { legend: { position: 'bottom' } } }} />
            )}
          </Tarjeta>

          <Tarjeta className="p-4 sm:p-5">
            <h2 className="mb-4 text-lg font-semibold">Consultas recibidas en el tiempo{rango.tipo && ` · ${TIPOS[rango.tipo]}`}</h2>
            <Grafico
              tipo="bar"
              datos={datosConsultasTiempo}
              descripcion="Gráfico de barras con la cantidad de consultas recibidas por período"
              opciones={{ scales: ejes, plugins: { legend: { display: false } } }}
            />
          </Tarjeta>

          <Tarjeta className="p-4 sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <UserPlus size={18} className="text-primary" aria-hidden="true" /> Consultas por estado
            </h2>
            {totalTipo === 0 ? (
              <p className="py-10 text-center text-ink-3">No hubo consultas en este período.</p>
            ) : (
              <Grafico
                tipo="bar"
                datos={datosEstado}
                className="h-60"
                descripcion="Gráfico de barras con las consultas recibidas por estado de seguimiento"
                opciones={{ indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#2a355655' } }, y: { grid: { display: false } } }, plugins: { legend: { display: false } } }}
              />
            )}
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
