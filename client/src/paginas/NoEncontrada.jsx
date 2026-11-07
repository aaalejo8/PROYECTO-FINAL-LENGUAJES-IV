import { Link } from '../router';
import { estiloBoton } from '../componentes/ui';

export default function NoEncontrada() {
  return (
    <section className="contenedor grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <p className="font-mono text-sm text-primary">Error 404</p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Esta página no existe</h1>
        <p className="mx-auto mt-4 max-w-md text-ink-2">Puede que el link esté mal escrito o que el contenido ya no esté disponible.</p>
        <Link to="/" className={estiloBoton('primario', 'md', 'mt-8')}>
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
