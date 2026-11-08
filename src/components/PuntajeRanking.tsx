'use client';

import type { ConfigRanking, LimiteKpi } from '@/lib/reglas';
import type { ScoreAsesor } from '@/lib/ranking';

const NOTA_LIMITE: Record<Exclude<LimiteKpi, null>, string> = {
  tope: 'llegó al tope',
  umbral: 'cuenta máx. 100%',
  piso: 'protegido en 100%',
};

// Desglose del puntaje ponderado del ranking mensual (Venta 80% · UPT 10% · AVT 10%).
export default function PuntajeRanking({ s, cfg }: { s: ScoreAsesor | undefined; cfg: ConfigRanking }) {
  if (!s || s.score === null) return null;
  const filas = ([
    { k: 'Venta', a: s.venta },
    { k: 'UPT', a: s.upt },
    { k: 'AVT', a: s.avt },
  ] as const).filter((f) => f.a.peso > 0);
  const sobreSinRescate = !s.rescate.habilitado && ((s.upt.pct ?? 0) > 100 || (s.avt.pct ?? 0) > 100);
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-[0.06em]">Puntaje del ranking</p>
        <p className="text-base font-bold text-heading tabular-nums">
          {s.score.toFixed(1)} <span className="text-[11px] font-medium text-gray-400">pts</span>
        </p>
      </div>
      <div className={`mt-2 grid gap-1.5 ${filas.length === 3 ? 'grid-cols-3' : filas.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {filas.map(({ k, a }) => (
          <div key={k} className="rounded-md bg-surface border border-gray-100 px-2 py-1.5 min-w-0">
            <p className="text-[10px] text-gray-400">{k} · {Math.round(a.peso * 100)}%</p>
            <p className="text-[12px] font-semibold text-gray-800 tabular-nums truncate">
              {a.pct === null ? '—' : `${a.pct.toFixed(0)}%`}
              <span className="text-gray-400 font-normal"> → {a.puntos.toFixed(1)}</span>
            </p>
            {a.limitadoPor && <p className="text-[10px] text-gray-500 truncate">{NOTA_LIMITE[a.limitadoPor]}</p>}
          </div>
        ))}
      </div>
      {(s.rescate.puntos > 0 || s.meta100PorRescate || sobreSinRescate) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {s.rescate.puntos > 0 && (
            <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md border bg-gold-light text-gold-text border-gold/50">
              🛟 Rescate +{s.rescate.puntos.toFixed(1)} pts
            </span>
          )}
          {s.meta100PorRescate && (
            <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md border bg-gold-light text-gold-text border-gold/50">
              📌 100% alcanzado por rescate
            </span>
          )}
          {sobreSinRescate && (
            <span className="text-[11px] text-gray-500">Tu UPT/AVT sumarán extra cuando tu venta llegue al {cfg.umbralRescate}%</span>
          )}
        </div>
      )}
    </div>
  );
}
