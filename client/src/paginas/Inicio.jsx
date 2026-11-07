import { useEffect, useState } from 'react';
import { api } from '../api';
import { useSesion } from '../contexto';
import { BloqueError, Cargando } from '../componentes/ui';
import { useReveal } from '../animaciones';
import Hero from '../secciones/Hero';
import Stack from '../secciones/Stack';
import Servicios from '../secciones/Servicios';
import Experiencia from '../secciones/Experiencia';
import Proyectos from '../secciones/Proyectos';
import ActividadGithub from '../secciones/ActividadGithub';
import Contacto from '../secciones/Contacto';

export default function Inicio() {
  const { usuario, cargando: cargandoSesion } = useSesion();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  // Se vuelve a pedir si cambia la sesión (los datos públicos son los mismos, pero así se actualiza el candado de los proyectos)
  useEffect(() => {
    if (cargandoSesion) return undefined;
    const control = new AbortController();
    setError('');
    api
      .portfolio(control.signal)
      .then(setDatos)
      .catch((e) => e.name !== 'AbortError' && setError(e.message));
    return () => control.abort();
  }, [intento, usuario?.id, cargandoSesion]);

  const raiz = useReveal([datos]);

  // Al llegar por un link con #ancla (por ejemplo /#contacto), se baja a la sección cuando el contenido ya está
  useEffect(() => {
    if (!datos || !window.location.hash) return;
    const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    el?.scrollIntoView({ block: 'start' });
  }, [datos]);

  if (error) {
    return (
      <div className="contenedor py-24">
        <BloqueError mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />
      </div>
    );
  }
  if (!datos) return <Cargando texto="Cargando el portfolio…" className="min-h-[70vh]" />;

  return (
    <div ref={raiz}>
      <Hero perfil={datos.perfil} tecnologias={datos.tecnologias} proyectos={datos.proyectos} />
      <Stack tecnologias={datos.tecnologias} />
      <Servicios servicios={datos.servicios} />
      <Experiencia experiencia={datos.experiencia} />
      <Proyectos proyectos={datos.proyectos} />
      <ActividadGithub />
      <Contacto perfil={datos.perfil} />
    </div>
  );
}
