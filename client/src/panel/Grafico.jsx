import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

// Colores del manual de marca para que los gráficos se vean parte del sitio
Chart.defaults.color = '#9aa6c4';
Chart.defaults.borderColor = '#2a3556';
Chart.defaults.font.family = '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';
Chart.defaults.plugins.tooltip.backgroundColor = '#131a2b';
Chart.defaults.plugins.tooltip.borderColor = '#5b6a94';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = '#e8ecf8';
Chart.defaults.plugins.tooltip.bodyColor = '#e8ecf8';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.legend.labels.usePointStyle = true;

export const COLORES = {
  primario: '#c6f432',
  secundario: '#22d3ee',
  acento: '#8b6cff',
  aviso: '#fbbf24',
  ok: '#34d399',
  info: '#60a5fa',
  peligro: '#f87171',
};

/**
 * Gráfico interactivo con Chart.js (canvas): tooltips al pasar el mouse o tocar, y se puede
 * ocultar/mostrar cada serie tocando su nombre en la leyenda.
 */
export default function Grafico({ tipo, datos, opciones, descripcion, className = 'h-72' }) {
  const canvas = useRef(null);
  const grafico = useRef(null);
  const opcionesRef = useRef(opciones);
  opcionesRef.current = opciones;

  useEffect(() => {
    grafico.current = new Chart(canvas.current, {
      type: tipo,
      data: datos,
      options: { responsive: true, maintainAspectRatio: false, ...opcionesRef.current },
    });
    return () => {
      grafico.current?.destroy();
      grafico.current = null;
    };
    // El gráfico se crea una vez por tipo; los datos nuevos se aplican en el efecto de abajo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  useEffect(() => {
    if (!grafico.current) return;
    grafico.current.data = datos;
    grafico.current.update();
  }, [datos]);

  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvas} role="img" aria-label={descripcion} />
    </div>
  );
}
