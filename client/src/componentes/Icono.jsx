import { Cloud, Code2, Cpu, Database, GitBranch, Globe, LayoutTemplate, MessageSquare, Server, ShieldCheck, Smartphone, Zap } from 'lucide-react';

/** Íconos que se pueden elegir para un servicio (los mismos nombres que acepta el servidor). */
export const ICONOS = {
  code: Code2,
  server: Server,
  database: Database,
  layout: LayoutTemplate,
  smartphone: Smartphone,
  cloud: Cloud,
  shield: ShieldCheck,
  zap: Zap,
  'git-branch': GitBranch,
  'message-square': MessageSquare,
  globe: Globe,
  cpu: Cpu,
};

export const NOMBRES_ICONOS = Object.keys(ICONOS);

export default function Icono({ nombre, size = 24, className = '' }) {
  const Componente = ICONOS[nombre] || Code2;
  return <Componente size={size} className={className} aria-hidden="true" />;
}
