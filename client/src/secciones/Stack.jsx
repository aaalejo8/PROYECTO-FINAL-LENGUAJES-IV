import { EncabezadoSeccion } from '../componentes/ui';

const CATEGORIAS = [
  ['frontend', 'Frontend', 'Lo que se ve y se toca'],
  ['backend', 'Backend', 'Lógica y APIs'],
  ['datos', 'Datos', 'Bases y consultas'],
  ['herramientas', 'Herramientas', 'Para trabajar en equipo'],
];

function Nivel({ nivel }) {
  return (
    <span className="flex gap-1" role="img" aria-label={`Nivel ${nivel} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`h-1.5 w-4 rounded-full ${n <= nivel ? 'bg-primary' : 'bg-line'}`} />
      ))}
    </span>
  );
}

export default function Stack({ tecnologias }) {
  return (
    <section id="stack" className="seccion border-b border-line bg-surface-1">
      <div className="contenedor">
        <EncabezadoSeccion etiqueta="01 · Stack" titulo="Las herramientas con las que trabajo">
          De la base de datos a la interfaz: tecnologías que uso todos los días para construir aplicaciones completas.
        </EncabezadoSeccion>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-reveal-grupo>
          {CATEGORIAS.map(([clave, titulo, ayuda]) => {
            const items = tecnologias.filter((t) => t.categoria === clave);
            if (items.length === 0) return null;
            return (
              <div key={clave} data-item className="rounded-lg border border-line bg-surface-2 p-5 transition-colors hover:border-line-strong">
                <h3 className="text-xl font-semibold">{titulo}</h3>
                <p className="mb-4 text-sm text-ink-3">{ayuda}</p>
                <ul className="space-y-3">
                  {items.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm text-ink">{t.nombre}</span>
                      <Nivel nivel={t.nivel} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
