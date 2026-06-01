'use client';

import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, orderBy, query, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  cargo: string;
}

interface MetaDia {
  upt: number;
  avt?: number;
  txn: number;
  uds: number;
  monto?: number;
  asesoresIds?: string[];
}

type DiaInput = { txn: string; uds: string; upt: string; avt: string; monto: string; asesoresIds: string[] };
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function shortAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

function buildCalendar(year: number, month: number): (Date | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const emptyDia: DiaInput = { txn: '', uds: '', upt: '', avt: '', monto: '', asesoresIds: [] };
const emptyMetasPorDia = (): MetasPorDiaInput => ({
  '1': { ...emptyDia }, '2': { ...emptyDia }, '3': { ...emptyDia },
  '4': { ...emptyDia }, '5': { ...emptyDia }, '6': { ...emptyDia },
  '0': { ...emptyDia },
});

export default function MetasDiarias() {
  const storeId = useStoreId();
  const mes = mesActual();

  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [metasPorDia, setMetasPorDia] = useState<MetasPorDiaInput>(emptyMetasPorDia());
  const [guardado, setGuardado] = useState<Record<string, MetaDia> | null>(null);
  const [metaMensualTxn, setMetaMensualTxn] = useState<number | null>(null);
  const [metaMensualUds, setMetaMensualUds] = useState<number | null>(null);
  const [metaMensualUpt, setMetaMensualUpt] = useState<number | null>(null);
  const [metaMensualAvt, setMetaMensualAvt] = useState<number | null>(null);
  const [metaMensualExiste, setMetaMensualExiste] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState('');

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const calDays = buildCalendar(year, month);
  const todayKey = String(today.getDay());
  const mesNombre = today.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!storeId) return;
    const q = query(collection(db, 'tiendas', storeId, 'asesores'), orderBy('creadoEn', 'asc'));
    return onSnapshot(q, (snap) => {
      setAsesores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asesor)));
    });
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    getDoc(doc(db, 'tiendas', storeId, 'metas', mes)).then((snap) => {
      setMetaMensualExiste(snap.exists());
      if (snap.exists()) {
        const data = snap.data() as {
          metasPorDia?: Record<string, MetaDia>;
          metaTransacciones?: number;
          metaUnidades?: number;
          metaUPT?: number;
          metaAVT?: number;
        };
        if (data.metaTransacciones) setMetaMensualTxn(data.metaTransacciones);
        if (data.metaUnidades) setMetaMensualUds(data.metaUnidades);
        if (data.metaUPT) setMetaMensualUpt(data.metaUPT);
        if (data.metaAVT) setMetaMensualAvt(data.metaAVT);
        if (data.metasPorDia) {
          setGuardado(data.metasPorDia);
          const loaded = emptyMetasPorDia();
          for (const [k, v] of Object.entries(data.metasPorDia)) {
            loaded[k] = {
              txn: v.txn > 0 ? String(v.txn) : '',
              uds: v.uds > 0 ? String(v.uds) : '',
              upt: v.upt > 0 ? String(v.upt) : '',
              avt: v.avt && v.avt > 0 ? String(v.avt) : '',
              monto: v.monto && v.monto > 0 ? String(v.monto) : '',
              asesoresIds: v.asesoresIds ?? [],
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
    const uptCalc = metaMensualUpt ?? 0;
    const avtCalc = metaMensualAvt ?? 0;
    const metasPorDiaSave: Record<string, MetaDia> = {};
    for (const { key } of DIAS_SEMANA) {
      const d = metasPorDia[key];
      const txn = parseInt(d?.txn || '0') || 0;
      const uds = parseInt(d?.uds || '0') || 0;
      const monto = parseFloat(d?.monto || '0') || 0;
      const asesoresIds = d?.asesoresIds ?? [];
      if (txn > 0 || uds > 0 || uptCalc > 0 || avtCalc > 0 || monto > 0 || asesoresIds.length > 0) {
        metasPorDiaSave[key] = { upt: uptCalc, ...(avtCalc > 0 && { avt: avtCalc }), txn, uds, monto, asesoresIds };
      }
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

  const distribuidoTxn = DIAS_SEMANA.reduce((a, { key }) => a + (Number(metasPorDia[key]?.txn) || 0), 0);
  const distribuidoUds  = DIAS_SEMANA.reduce((a, { key }) => a + (Number(metasPorDia[key]?.uds)  || 0), 0);
  const restanteTxn = metaMensualTxn !== null ? metaMensualTxn - distribuidoTxn : null;
  const restanteUds  = metaMensualUds  !== null ? metaMensualUds  - distribuidoUds  : null;

  const toggleAsesor = (id: string) => {
    setMetasPorDia((prev) => {
      const ids = [...(prev[todayKey]?.asesoresIds ?? [])];
      const idx = ids.indexOf(id);
      if (idx > -1) ids.splice(idx, 1);
      else ids.push(id);
      return { ...prev, [todayKey]: { ...prev[todayKey], asesoresIds: ids } };
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  // ── SIN META MENSUAL ───────────────────────────────────────────────────────
  if (!metaMensualExiste) {
    return (
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p className="text-sm text-amber-700 leading-relaxed">
          No hay meta mensual configurada. Ve a la pestaña <span className="font-semibold">Meta del mes</span> y configúrala primero.
        </p>
      </div>
    );
  }

  // ── VISTA ──────────────────────────────────────────────────────────────────
  if (guardado && !editando) {
    const todayMeta = guardado[todayKey];
    const asesoresToday = todayMeta?.asesoresIds?.length
      ? asesores.filter((a) => todayMeta.asesoresIds!.includes(a.id))
      : [];
    const n = asesoresToday.length;
    const montoPorAsesor = n > 0 && todayMeta?.monto && todayMeta.monto > 0 ? todayMeta.monto / n : 0;
    const txnPorAsesor   = n > 0 && todayMeta?.txn  && todayMeta.txn  > 0 ? todayMeta.txn  / n : 0;
    const udsPorAsesor   = n > 0 && todayMeta?.uds  && todayMeta.uds  > 0 ? todayMeta.uds  / n : 0;

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
                      {targets.monto && targets.monto > 0 && (
                        <p className={`text-[9px] leading-none ${isToday ? 'text-gray-400' : 'text-gray-400'}`}>
                          {shortAmount(targets.monto)}
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

        {/* Meta de hoy */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Meta de hoy</p>

          {todayMeta ? (
            <>
              {(todayMeta.txn > 0 || todayMeta.uds > 0 || todayMeta.upt > 0 || (todayMeta.avt ?? 0) > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  {todayMeta.txn > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-0.5">Transacciones</p>
                      <p className="text-lg font-bold text-gray-900">{todayMeta.txn}</p>
                    </div>
                  )}
                  {todayMeta.uds > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-0.5">Unidades</p>
                      <p className="text-lg font-bold text-gray-900">{todayMeta.uds}</p>
                    </div>
                  )}
                  {todayMeta.upt > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-0.5">UPT</p>
                      <p className="text-lg font-bold text-gray-900">{todayMeta.upt}</p>
                    </div>
                  )}
                  {(todayMeta.avt ?? 0) > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-0.5">AVT</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(todayMeta.avt!)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Distribución por asesor: monto, txn y uds */}
              {asesoresToday.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-gray-600">Distribución por asesor</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {todayMeta.txn > 0 && <span>{todayMeta.txn} txn</span>}
                      {todayMeta.uds > 0 && <span>{todayMeta.uds} uds</span>}
                      {todayMeta.monto && todayMeta.monto > 0 && (
                        <span className="font-semibold text-gray-900">{formatCurrency(todayMeta.monto)}</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {asesoresToday.map((a) => (
                      <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.nombre} {a.apellido}</p>
                          <p className="text-xs text-gray-400">{a.cargo}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {txnPorAsesor > 0 && (
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Txn</p>
                              <p className="text-sm font-bold text-gray-900">{Math.round(txnPorAsesor)}</p>
                            </div>
                          )}
                          {udsPorAsesor > 0 && (
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Uds</p>
                              <p className="text-sm font-bold text-gray-900">{Math.round(udsPorAsesor)}</p>
                            </div>
                          )}
                          {montoPorAsesor > 0 && (
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Monto</p>
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(montoPorAsesor)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 text-right">
                      {n} asesor{n !== 1 ? 'es' : ''} ·{txnPorAsesor > 0 ? ` ${Math.round(txnPorAsesor)} txn` : ''}{udsPorAsesor > 0 ? ` · ${Math.round(udsPorAsesor)} uds` : ''}{montoPorAsesor > 0 ? ` · ${formatCurrency(montoPorAsesor)}` : ''} c/u
                    </p>
                  </div>
                </div>
              )}

              {!asesoresToday.length && (
                <p className="text-xs text-gray-400">Sin asesores asignados para hoy.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">No hay meta configurada para hoy.</p>
          )}
        </div>
      </div>
    );
  }

  // ── FORMULARIO ─────────────────────────────────────────────────────────────
  const todayInput   = metasPorDia[todayKey];
  const montoTotal   = parseFloat(todayInput?.monto || '0') || 0;
  const txnTotal     = parseInt(todayInput?.txn || '0') || 0;
  const udsTotal     = parseInt(todayInput?.uds || '0') || 0;
  const asesoresSel  = todayInput?.asesoresIds ?? [];
  const n = asesoresSel.length;

  const montoPorAsesorPreview = n > 0 && montoTotal > 0 ? montoTotal / n : 0;
  const txnPorAsesorPreview   = n > 0 && txnTotal   > 0 ? txnTotal   / n : 0;
  const udsPorAsesorPreview   = n > 0 && udsTotal   > 0 ? udsTotal   / n : 0;

  const hayPreview = montoPorAsesorPreview > 0 || txnPorAsesorPreview > 0 || udsPorAsesorPreview > 0;

  return (
    <div className="space-y-6 max-w-lg">
      {!guardado && (
        <p className="text-sm text-gray-500">
          Define el objetivo diario. El calendario se actualizará automáticamente.
        </p>
      )}

      {/* Tabla txn / uds */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-gray-400">
              <th className="text-left px-4 py-3 font-medium">Día</th>
              <th className="text-center px-2 py-3 font-medium">Transacciones día</th>
              <th className="text-center px-2 py-3 font-medium">Unidades día</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {DIAS_SEMANA.filter(({ key }) => key === todayKey).map(({ key, label }) => (
              <tr key={key}>
                <td className="px-4 py-2.5 font-medium text-gray-700">{label}</td>
                {(['txn', 'uds'] as const).map((field) => (
                  <td key={field} className="px-2 py-2 text-center">
                    <input
                      type="number"
                      step="1"
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

        {/* Restante del mes */}
        {(metaMensualTxn !== null || metaMensualUds !== null) && (
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
            {metaMensualTxn !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Transacciones del mes</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{distribuidoTxn} distribuidas</span>
                  <span className="text-gray-300">/</span>
                  <span className="font-semibold text-gray-700">{metaMensualTxn} meta</span>
                  <span className={`font-semibold ${restanteTxn !== null && restanteTxn < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                    → {restanteTxn !== null ? restanteTxn : '—'} restantes
                  </span>
                </div>
              </div>
            )}
            {metaMensualUds !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Unidades del mes</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{distribuidoUds} distribuidas</span>
                  <span className="text-gray-300">/</span>
                  <span className="font-semibold text-gray-700">{metaMensualUds} meta</span>
                  <span className={`font-semibold ${restanteUds !== null && restanteUds < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                    → {restanteUds !== null ? restanteUds : '—'} restantes
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Presupuesto diario + selección de asesores */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">Presupuesto del día</p>
          <input
            type="number"
            value={todayInput?.monto ?? ''}
            onChange={(e) =>
              setMetasPorDia((prev) => ({
                ...prev,
                [todayKey]: { ...prev[todayKey], monto: e.target.value },
              }))
            }
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
            placeholder="Ej. 5000000"
            min={0}
          />
        </div>

        {(metaMensualUpt !== null || metaMensualAvt !== null) && (
          <div className="grid grid-cols-2 gap-3">
            {metaMensualUpt !== null && (
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">UPT</p>
                <p className="text-sm font-bold text-gray-900">{metaMensualUpt}</p>
              </div>
            )}
            {metaMensualAvt !== null && (
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">AVT</p>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(metaMensualAvt)}</p>
              </div>
            )}
          </div>
        )}

        {asesores.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">
              Dividir entre asesores que trabajan hoy
              {hayPreview && n > 0 && (
                <span className="text-gray-400 font-normal ml-2">
                  →{txnPorAsesorPreview > 0 ? ` ${Math.round(txnPorAsesorPreview)} txn` : ''}{udsPorAsesorPreview > 0 ? ` · ${Math.round(udsPorAsesorPreview)} uds` : ''}{montoPorAsesorPreview > 0 ? ` · ${formatCurrency(montoPorAsesorPreview)}` : ''} c/u
                </span>
              )}
            </p>
            <div className="space-y-2">
              {asesores.map((a) => {
                const selected = asesoresSel.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                      selected
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-100 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleAsesor(a.id)}
                      className="w-4 h-4 accent-gray-900 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.nombre} {a.apellido}</p>
                      <p className="text-xs text-gray-400">{a.cargo}</p>
                    </div>
                    {selected && hayPreview && (
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {txnPorAsesorPreview > 0 && (
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400">Txn</p>
                            <p className="text-sm font-bold text-gray-900">{Math.round(txnPorAsesorPreview)}</p>
                          </div>
                        )}
                        {udsPorAsesorPreview > 0 && (
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400">Uds</p>
                            <p className="text-sm font-bold text-gray-900">{Math.round(udsPorAsesorPreview)}</p>
                          </div>
                        )}
                        {montoPorAsesorPreview > 0 && (
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400">Monto</p>
                            <p className="text-sm font-bold text-gray-900">{formatCurrency(montoPorAsesorPreview)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
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
