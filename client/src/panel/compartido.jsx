import { Boton } from '../componentes/ui';
import Superposicion from '../componentes/Superposicion';

/** Confirmación antes de borrar o hacer algo que no se puede deshacer. */
export function Confirmar({ abierto, titulo, texto, textoBoton = 'Confirmar', cargando = false, onConfirmar, onCerrar }) {
  return (
    <Superposicion abierto={abierto} onCerrar={onCerrar} titulo={titulo} ancho="max-w-md">
      <div className="p-5">
        <p className="text-ink-2">{texto}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Boton variante="fantasma" onClick={onCerrar} data-autofocus>
            Cancelar
          </Boton>
          <Boton variante="peligro" cargando={cargando} onClick={onConfirmar}>
            {textoBoton}
          </Boton>
        </div>
      </div>
    </Superposicion>
  );
}

/** Tabla que en el celular se desplaza hacia los costados. */
export function Tabla({ columnas, children, vacia }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-3">
            {columnas.map((c) => (
              <th key={c} scope="col" className="px-4 py-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {vacia}
    </div>
  );
}

/** Busca y devuelve un mensaje legible de un error de validación del servidor. */
export const mensajeDeError = (error) => error?.message || 'Ocurrió un error. Probá de nuevo.';
