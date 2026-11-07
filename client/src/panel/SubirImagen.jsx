import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { api } from '../api';
import { Boton } from '../componentes/ui';

const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_ORIGINAL = 12 * 1024 * 1024; // lo que se acepta elegir (después se achica)
const MAX_FINAL = 4 * 1024 * 1024; // lo que acepta el servidor
const ANCHO_MAXIMO = 1280;

/** Valida el archivo, lo achica en el navegador (máx. 1280 px de ancho) y lo convierte a WebP/JPEG. */
async function prepararImagen(archivo) {
  if (!TIPOS_OK.includes(archivo.type)) throw new Error('Elegí una imagen JPG, PNG o WebP.');
  if (archivo.size > MAX_ORIGINAL) throw new Error('La imagen pesa demasiado (máximo 12 MB).');

  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No pude leer esa imagen. Probá con otra.'));
      i.src = url;
    });
    const escala = Math.min(1, ANCHO_MAXIMO / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    const aBlob = (tipo, calidad) => new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
    let blob = await aBlob('image/webp', 0.85);
    if (!blob || blob.type !== 'image/webp') blob = await aBlob('image/jpeg', 0.88);
    if (!blob) throw new Error('No pude procesar la imagen.');
    if (blob.size > MAX_FINAL) throw new Error('La imagen sigue pesando más de 4 MB después de achicarla. Probá con otra.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SubirImagen({ valor, onChange }) {
  const entrada = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const elegir = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setError('');
    setSubiendo(true);
    try {
      const blob = await prepararImagen(archivo);
      const { url } = await api.subirImagen(blob);
      onChange(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div>
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
        Imagen de portada <span className="text-xs font-normal text-ink-3">Opcional · JPG, PNG o WebP</span>
      </span>
      <div className="flex flex-wrap items-center gap-4 rounded-md border border-dashed border-line-strong p-4">
        {valor ? (
          <img src={valor} alt="Vista previa de la portada" className="h-24 w-40 rounded-sm border border-line object-cover" />
        ) : (
          <span className="grid h-24 w-40 place-items-center rounded-sm bg-surface-1 text-ink-3">
            <ImagePlus size={28} aria-hidden="true" />
          </span>
        )}
        <div className="flex flex-col gap-2">
          <input ref={entrada} type="file" accept={TIPOS_OK.join(',')} onChange={elegir} className="sr-only" aria-label="Elegir imagen de portada" tabIndex={-1} />
          <Boton variante="secundario" tamano="sm" icono={Upload} cargando={subiendo} onClick={() => entrada.current?.click()}>
            {valor ? 'Cambiar imagen' : 'Subir imagen'}
          </Boton>
          {valor && (
            <Boton variante="fantasma" tamano="sm" icono={Trash2} onClick={() => onChange('')}>
              Quitar
            </Boton>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
