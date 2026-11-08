'use client';

import { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';
import { useConfigRanking } from '@/lib/ranking';
import { CONFIG_RANKING_DEFAULT, normalizarConfigRanking, type ConfigRanking } from '@/lib/reglas';

type Campo = 'topeUPT' | 'topeAVT' | 'umbralRescate' | 'minTxnIndicadores';

const CAMPOS: { k: Campo; label: string; ayuda: string; min: number; max: number; unidad: string }[] = [
  { k: 'topeUPT', label: 'Tope UPT', ayuda: 'Máximo % de UPT que cuenta (130 = hasta 13 pts)', min: 100, max: 300, unidad: '%' },
  { k: 'topeAVT', label: 'Tope AVT', ayuda: 'Máximo % de AVT que cuenta (130 = hasta 13 pts)', min: 100, max: 300, unidad: '%' },
  { k: 'umbralRescate', label: 'Umbral de rescate', ayuda: '% de venta desde el que UPT/AVT suman extra', min: 50, max: 100, unidad: '%' },
  { k: 'minTxnIndicadores', label: 'Mínimo de ventas', ayuda: 'Transacciones en el mes para que UPT/AVT empiecen a sumar', min: 0, max: 500, unidad: 'txn' },
];

export default function ConfigRankingPanel() {
  const storeId = useStoreId();
  const cfg = useConfigRanking(storeId);
  const [borrador, setBorrador] = useState<Partial<Record<Campo, string>>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const valor = (k: Campo) => borrador[k] ?? String(cfg[k]);
  const sucio = CAMPOS.some(({ k }) => borrador[k] !== undefined && Number(borrador[k]) !== cfg[k]);

  const vista: ConfigRanking = normalizarConfigRanking({
    ...cfg,
    ...Object.fromEntries(CAMPOS.map(({ k }) => [k, Number(valor(k))])),
  });
  // Venta mínima con la que UPT y AVT al tope alcanzan a completar 100 puntos.
  const ventaMinRescate = Math.max(
    vista.umbralRescate,
    (100 - vista.topeUPT * vista.pesoUPT - vista.topeAVT * vista.pesoAVT) / vista.pesoVenta,
  );

  async function guardar() {
    setError('');
    for (const { k, label, min, max } of CAMPOS) {
      const n = Number(valor(k));
      if (!Number.isFinite(n) || n < min || n > max) return setError(`${label} debe estar entre ${min} y ${max}.`);
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'tiendas', storeId, 'config', 'ranking'), {
        ...cfg,
        ...Object.fromEntries(CAMPOS.map(({ k }) => [k, Number(valor(k))])),
        actualizadoEn: serverTimestamp(),
      }, { merge: true });
      setBorrador({});
      setMsg('Parámetros guardados. El ranking se recalcula en vivo.');
      setTimeout(() => setMsg(''), 3500);
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.');
    }
    setSaving(false);
  }

  return (
    <section className="theme-panel bg-surface border border-gray-200 rounded-2xl p-6 max-w-lg" aria-labelledby="cfg-ranking-titulo">
      <h3 id="cfg-ranking-titulo" className="text-base font-semibold text-heading">Puntaje del ranking</h3>
      <p className="mt-1 text-[13px] text-gray-500 [text-wrap:pretty]">
        El ranking mensual se ordena por puntos: <b className="text-gray-700">Venta {Math.round(cfg.pesoVenta * 100)}%</b> ·{' '}
        <b className="text-gray-700">UPT {Math.round(cfg.pesoUPT * 100)}%</b> · <b className="text-gray-700">AVT {Math.round(cfg.pesoAVT * 100)}%</b>.
        Un buen UPT y AVT pueden &quot;rescatar&quot; a quien está cerca de su meta.
      </p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CAMPOS.map(({ k, label, ayuda, min, max, unidad }) => (
          <div key={k}>
            <label htmlFor={`cfg-${k}`} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <div className="relative">
              <input
                id={`cfg-${k}`}
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                value={valor(k)}
                onChange={(e) => setBorrador((b) => ({ ...b, [k]: e.target.value }))}
                className="w-full pl-3 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors text-gray-900 tabular-nums"
                autoComplete="off"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" aria-hidden="true">{unidad}</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-gray-400">{ayuda}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-lg bg-primary-light border border-primary/15 px-3 py-2 text-[12px] text-primary [text-wrap:pretty]">
        Con estos valores, un asesor puede llegar a 100 puntos con rescate desde el{' '}
        <b className="tabular-nums">{ventaMinRescate.toFixed(1)}%</b> de su venta. Bono corral y Día libre siempre exigen venta real.
      </p>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      {msg && <p role="status" className="mt-3 text-[13px] text-emerald-700">{msg}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setBorrador(Object.fromEntries(CAMPOS.map(({ k }) => [k, String(CONFIG_RANKING_DEFAULT[k])])))}
          className="px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          Valores por defecto
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={saving || !sucio}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-on-accent bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar parámetros'}
        </button>
      </div>
    </section>
  );
}
