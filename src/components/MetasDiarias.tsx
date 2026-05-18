'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';

interface MetaDia {
  upt: number;
  txn: number;
  uds: number;
}

type DiaInput = { upt: string; txn: string; uds: string };
type MetasPorDiaInput = Record<string, DiaInput>;

const DIAS_SEMANA = [
  { key: '1', label: 'Lunes',     short: 'Lun' },
  { key: '2', label: 'Martes',    short: 'Mar' },
  { key: '3', label: 'Miércoles', short: 'Mié' },
  { key: '4', label: 'Jueves',    short: 'Jue' },
  { key: '5', label: 'Viernes',   short: 'Vie' },
  { key: '6', label: 'Sábado',    short: 'Sáb' },
  { key: '0', label: 'Domingo',   short: 'Dom' },
];

const CAL_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function buildCalendar(year: number, month: number): (Date | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function contarDiasMes(year: number, month: number): Record<string, number> {
  const total = new Date(year, month + 1, 0).getDate();
  const count: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
  for (let d = 1; d <= total; d++) count[String(new Date(year, month, d).getDay())]++;
  return count;
}

const emptyDia: DiaInput = { upt: '', txn: '', uds: '' };
const emptyMetasPorDia = (): MetasPorDiaInput => ({
  '1': { ...emptyDia }, '2': { ...emptyDia }, '3': { ...emptyDia },
  '4': { ...emptyDia }, '5': { ...emptyDia }, '6': { ...emptyDia },
  '0': { ...emptyDia },
});

export default function MetasDiarias() {
  const storeId = useStoreId();
  const mes = mesActual();
  const [metasPorDia, setMetasPorDia] = useState<MetasPorDiaInput>(emptyMetasPorDia());
  const [guardado, setGuardado] = useState<Record<string, MetaDia> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState('');

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const calDays = buildCalendar(year, month);
  const conteos = contarDiasMes(year, month);

  useEffect(() => {
    if (!storeId) return;
    getDoc(doc(db, 'tiendas', storeId, 'metas', mes)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as { metasPorDia?: Record<string, MetaDia> };
        if (data.metasPorDia) {
          setGuardado(data.metasPorDia);
          const loaded = emptyMetasPorDia();
          for (const [k, v] of Object.entries(data.metasPorDia)) {
            loaded[k] = {
              upt: v.upt > 0 ? String(v.upt) : '',
              txn: v.txn > 0 ? String(v.txn) : '',
              uds: v.uds > 0 ? String(v.uds) : '',
            };
          }
          setMetasPorDia(loaded);
        }
      }
      setLoading(false);
    });
  }, [storeId, mes]);

  const handleGuardar = async () => {
    setError('');
    setSaving(true);
    const metasPorDiaSave: Record<string, MetaDia> = {};
    for (const { key } of DIAS_SEMANA) {
      const d = metasPorDia[key];
      const upt = parseFloat(d?.upt || '0') || 0;
      const txn = parseInt(d?.txn || '0') || 0;
      const uds = parseInt(d?.uds || '0') || 0;
      if (upt > 0 || txn > 0 || uds > 0) metasPorDiaSave[key] = { upt, txn, uds };
    }
    try {
      await setDoc(
        doc(db, 'tiendas', storeId, 'metas', mes),
        { metasPorDia: metasPorDiaSave, actualizadoEn: serverTimestamp() },
        { merge: true }
      );
      setGuardado(metasPorDiaSave);
      setEditando(false);
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    }
    setSaving(false);
  };

  const totales = {
    txn: DIAS_SEMANA.reduce((a, { key }) => a + (Number(metasPorDia[key]?.txn) || 0) * conteos[key], 0),
    uds: DIAS_SEMANA.reduce((a, { key }) => a + (Number(metasPorDia[key]?.uds) || 0) * conteos[key], 0),
  };

  const mesNombre = today.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  // ── VISTA ────────────────────────────────────────────────────────────────
  if (guardado && !editando) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Metas por día</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5 capitalize">{mesNombre}</p>
          </div>
          <button
            onClick={() => setEditando(true)}
            className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Editar
          </button>
        </div>

        {/* Calendario */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="grid grid-cols-7 mb-2">
            {CAL_HEADERS.map((h) => (
              <div key={h} className="text-center text-[11px] font-medium text-gray-400 pb-1">{h}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calDays.map((date, i) => {
              if (!date) return <div key={i} />;
              const dow = String(date.getDay());
              const targets = guardado[dow];
              const isToday = date.toDateString() === today.toDateString();
              const isPast  = date < today && !isToday;
              return (
                <div
                  key={i}
                  className={`rounded-xl p-1.5 min-h-[54px] flex flex-col items-center ${
                    isToday ? 'bg-gray-900' : isPast ? 'bg-gray-50' : 'bg-white border border-gray-100'
                  }`}
                >
                  <span className={`text-xs font-semibold ${isToday ? 'text-white' : isPast ? 'text-gray-400' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </span>
                  {targets && (
                    <div className={`mt-0.5 w-full text-center space-y-0.5 ${isPast ? 'opacity-40' : ''}`}>
                      {targets.txn > 0 && (
                        <p className={`text-[9px] leading-none ${isToday ? 'text-gray-300' : 'text-gray-500'}`}>
                          {targets.txn}<span className="opacity-60">txn</span>
                        </p>
                      )}
                      {targets.upt > 0 && (
                        <p className={`text-[9px] leading-none ${isToday ? 'text-gray-400' : 'text-gray-400'}`}>
                          {targets.upt}<span className="opacity-60">UPT</span>
                        </p>
                      )}
                      {targets.uds > 0 && (
                        <p className={`text-[9px] leading-none ${isToday ? 'text-gray-400' : 'text-gray-400'}`}>
                          {targets.uds}<span className="opacity-60">uds</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabla resumen por día de semana */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Target por día de semana</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Día</th>
                <th className="text-center pb-2 font-medium">UPT</th>
                <th className="text-center pb-2 font-medium">Txn</th>
                <th className="text-center pb-2 font-medium">Unidades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {DIAS_SEMANA.map(({ key, label }) => {
                const d = guardado[key];
                if (!d) return (
                  <tr key={key}>
                    <td className="py-2 text-gray-400">{label}</td>
                    <td className="py-2 text-center text-gray-300">—</td>
                    <td className="py-2 text-center text-gray-300">—</td>
                    <td className="py-2 text-center text-gray-300">—</td>
                  </tr>
                );
                return (
                  <tr key={key}>
                    <td className="py-2 text-gray-700 font-medium">{label}</td>
                    <td className="py-2 text-center text-gray-900">{d.upt > 0 ? d.upt.toFixed(2) : '—'}</td>
                    <td className="py-2 text-center text-gray-900">{d.txn > 0 ? d.txn : '—'}</td>
                    <td className="py-2 text-center text-gray-900">{d.uds > 0 ? d.uds : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── FORMULARIO ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-lg">
      {!guardado && (
        <p className="text-sm text-gray-500">
          Define el objetivo diario para cada tipo de día. El calendario se actualizará automáticamente.
        </p>
      )}

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-gray-400">
              <th className="text-left px-4 py-3 font-medium">Día</th>
              <th className="text-center px-2 py-3 font-medium">UPT</th>
              <th className="text-center px-2 py-3 font-medium">Txn / día</th>
              <th className="text-center px-2 py-3 font-medium">Uds / día</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {DIAS_SEMANA.map(({ key, label }) => (
              <tr key={key}>
                <td className="px-4 py-2.5 font-medium text-gray-700">{label}</td>
                {(['upt', 'txn', 'uds'] as const).map((field) => (
                  <td key={field} className="px-2 py-2 text-center">
                    <input
                      type="number"
                      step={field === 'upt' ? '0.1' : '1'}
                      value={metasPorDia[key]?.[field] ?? ''}
                      onChange={(e) =>
                        setMetasPorDia((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], [field]: e.target.value },
                        }))
                      }
                      className="w-16 px-1.5 py-1.5 text-xs text-center border border-gray-200 rounded-lg outline-none focus:border-gray-900 transition-colors text-gray-900"
                      placeholder="—"
                      min={0}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {(totales.txn > 0 || totales.uds > 0) && (
          <div className="border-t border-gray-100 px-4 py-2.5 flex flex-wrap gap-4 bg-gray-50">
            <span className="text-xs text-gray-400">Total mes estimado:</span>
            {totales.txn > 0 && (
              <span className="text-xs font-medium text-gray-700">{Math.round(totales.txn)} transacciones</span>
            )}
            {totales.uds > 0 && (
              <span className="text-xs font-medium text-gray-700">{Math.round(totales.uds)} unidades</span>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        {editando && (
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="flex-1 px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleGuardar}
          disabled={saving}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar metas diarias'}
        </button>
      </div>
    </div>
  );
}
