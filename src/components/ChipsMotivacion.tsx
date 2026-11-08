'use client';

import type { Insignia, Racha } from '@/lib/motivacion';

interface Props {
  racha: Racha;
  sobreRecord: number | null;
  insignias: Insignia[];
  mayorProgreso: number | null;
  size?: 'sm' | 'lg';
  className?: string;
  max?: number;
}

export default function ChipsMotivacion({ racha, sobreRecord, insignias, mayorProgreso, size = 'sm', className = '', max }: Props) {
  const chips: { key: string; text: string; cls: string; title?: string }[] = [];

  if (racha.dias > 0) {
    chips.push({
      key: 'racha',
      text: racha.hoyRegistrado
        ? (racha.dias === 1 ? '🔥 1 día de racha' : `🔥 ${racha.dias} días seguidos`)
        : `🔥 ${racha.dias} ${racha.dias === 1 ? 'día' : 'días'} · ¡registra hoy!`,
      cls: 'bg-gold-light text-gold-text border-gold/50',
      title: 'Días seguidos registrando ventas',
    });
  }
  if (sobreRecord !== null && sobreRecord > 0) {
    chips.push({
      key: 'record',
      text: `📈 Récord personal +${Math.round(sobreRecord)}%`,
      cls: 'bg-gold-light text-gold-text border-gold/50',
      title: 'Por encima de su mejor mes anterior',
    });
  }
  if (mayorProgreso !== null) {
    chips.push({
      key: 'progreso',
      text: `🚀 Mayor progreso de la semana`,
      cls: 'bg-gold-light text-gold-text border-gold/50',
      title: `+${Math.round(mayorProgreso)}% frente a la semana anterior`,
    });
  }
  for (const ins of insignias) {
    chips.push({ key: ins.id, text: `${ins.emoji} ${ins.label}`, cls: 'bg-gold-light text-gold-text border-gold/50' });
  }

  if (chips.length === 0) return null;
  // Las tarjetas del ranking ya son densas: se muestran los primeros (racha y récord van primero) y el resto como "+N".
  const visibles = max && chips.length > max ? chips.slice(0, max - 1) : chips;
  const ocultos = chips.slice(visibles.length);
  const sz = size === 'lg' ? 'text-sm px-2.5 py-1' : 'text-[11px] px-2 py-0.5';
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Logros">
      {visibles.map((c) => (
        <li key={c.key} title={c.title} className={`inline-flex items-center rounded-md border font-medium ${sz} ${c.cls}`}>
          {c.text}
        </li>
      ))}
      {ocultos.length > 0 && (
        <li title={ocultos.map((c) => c.text).join(' · ')} className={`inline-flex items-center rounded-md border font-medium ${sz} bg-gold-light text-gold-text border-gold/50`}>
          <span aria-hidden="true">+{ocultos.length}</span>
          <span className="sr-only">{ocultos.map((c) => c.text).join(', ')}</span>
        </li>
      )}
    </ul>
  );
}
