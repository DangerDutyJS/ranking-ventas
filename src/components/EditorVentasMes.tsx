'use client';

import { useState, useEffect } from 'react';
import { collection, doc, getDoc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';
import Image from 'next/image';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  fotoBase64?: string;
}

interface VentaMes {
  asesorId: string;
  totalVentas: number;
  totalUnidades: number;
  totalTransacciones: number;
  acumuladoMes?: { monto: number; unidades: number; transacciones: number };
}

interface RowState {
  monto: string;
  txn: string;
  uds: string;
}

const FIELDS: { field: keyof RowState; label: string; step: string }[] = [
  { field: 'monto', label: 'Monto', step: 'any' },
  { field: 'txn',   label: 'Txn',   step: '1'   },
  { field: 'uds',   label: 'Uds',   step: '1'   },
];

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fechaHoy() {
  return new Date().toLocaleDateString('fr-CA');
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function grandTotals(vm: VentaMes | undefined) {
  return {
    monto: (vm?.totalVentas        ?? 0) + (vm?.acumuladoMes?.monto         ?? 0),
    txn:   (vm?.totalTransacciones ?? 0) + (vm?.acumuladoMes?.transacciones ?? 0),
    uds:   (vm?.totalUnidades      ?? 0) + (vm?.acumuladoMes?.unidades      ?? 0),
  };
}

export default function EditorVentasMes() {
  const storeId = useStoreId();
  const mes = mesActual();

  const [asesores, setAsesores]         = useState<Asesor[]>([]);
  const [ventasMap, setVentasMap]       = useState<Record<string, VentaMes>>({});
  const [rows, setRows]                 = useState<Record<string, RowState>>({});
  const [baseline, setBaseline]         = useState<Record<string, RowState>>({});
  const [asesorLoading, setAsesorLoading] = useState(true);
  const [ventasLoading, setVentasLoading] = useState(true);
  const [saving, setSaving]             = useState(false);
  const [successMsg, setSuccessMsg]     = useState('');

  useEffect(() => {
    const q = query(collection(db, 'tiendas', storeId, 'asesores'), orderBy('creadoEn', 'asc'));
    return onSnapshot(q, (snap) => {
      setAsesores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asesor)));
      setAsesorLoading(false);
    });
  }, [storeId]);

  useEffect(() => {
    return onSnapshot(collection(db, 'tiendas', storeId, 'ventasMes'), (snap) => {
      const map: Record<string, VentaMes> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as VentaMes & { mes: string };
        if (data.mes === mes) map[data.asesorId] = data;
      });
      setVentasMap(map);
      setVentasLoading(false);
    });
  }, [storeId, mes]);

  // Initialize rows only for advisors not yet in state
  useEffect(() => {
    if (asesorLoading || ventasLoading) return;
    setRows((prev) => {
      const next = { ...prev };
      let changed = false;
      asesores.forEach((a) => {
        if (next[a.id] !== undefined) return;
        const g = grandTotals(ventasMap[a.id]);
        next[a.id] = { monto: String(g.monto), txn: String(g.txn), uds: String(g.uds) };
        changed = true;
      });
      return changed ? next : prev;
    });
    setBaseline((prev) => {
      const next = { ...prev };
      let changed = false;
      asesores.forEach((a) => {
        if (next[a.id] !== undefined) return;
        const g = grandTotals(ventasMap[a.id]);
        next[a.id] = { monto: String(g.monto), txn: String(g.txn), uds: String(g.uds) };
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [asesorLoading, ventasLoading, asesores, ventasMap]);

  const loading = asesorLoading || ventasLoading;

  function isDirty(id: string) {
    const b = baseline[id];
    const r = rows[id];
    if (!b || !r) return false;
    return b.monto !== r.monto || b.txn !== r.txn || b.uds !== r.uds;
  }

  const dirtyIds = asesores.filter((a) => isDirty(a.id)).map((a) => a.id);

  function updateRow(id: string, field: keyof RowState, value: string) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function resetRow(id: string) {
    const b = baseline[id];
    if (b) setRows((prev) => ({ ...prev, [id]: { ...b } }));
  }

  async function handleSave() {
    if (dirtyIds.length === 0 || saving) return;
    // Capture snapshot of values to save
    const toSave = dirtyIds.map((id) => ({ id, row: { ...rows[id] } }));
    setSaving(true);
    try {
      for (const { id: asesorId, row } of toSave) {
        const vm = ventasMap[asesorId];

        const newMonto = parseFloat(row.monto) || 0;
        const newTxn   = parseInt(row.txn)    || 0;
        const newUds   = parseInt(row.uds)    || 0;

        // Only acumuladoMes is written — daily registros[] are untouched
        const acumMonto = newMonto - (vm?.totalVentas        ?? 0);
        const acumTxn   = newTxn   - (vm?.totalTransacciones ?? 0);
        const acumUds   = newUds   - (vm?.totalUnidades      ?? 0);

        const acumEntry = (acumMonto !== 0 || acumTxn !== 0 || acumUds !== 0)
          ? [{ id: crypto.randomUUID(), monto: acumMonto, transacciones: acumTxn, unidades: acumUds, fecha: fechaHoy(), creadoEn: new Date().toISOString() }]
          : [];

        const docRef = doc(db, 'tiendas', storeId, 'ventasMes', `${mes}_${asesorId}`);
        const snap   = await getDoc(docRef);

        if (snap.exists()) {
          await updateDoc(docRef, {
            acumuladoMes: { monto: acumMonto, transacciones: acumTxn, unidades: acumUds },
            acumulados: acumEntry,
          });
        } else {
          await setDoc(docRef, {
            mes, asesorId,
            totalVentas: 0, totalUnidades: 0, totalTransacciones: 0, registros: [],
            acumuladoMes: { monto: acumMonto, transacciones: acumTxn, unidades: acumUds },
            acumulados: acumEntry,
          });
        }
      }

      // Baseline now matches saved rows — dirty clears
      setBaseline((prev) => {
        const next = { ...prev };
        toSave.forEach(({ id, row }) => { next[id] = { ...row }; });
        return next;
      });

      const n = toSave.length;
      setSuccessMsg(`${n} asesor${n !== 1 ? 'es' : ''} actualizado${n !== 1 ? 's' : ''}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch { /* silent */ }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (asesores.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-16">No hay asesores registrados.</p>;
  }

  return (
    <div className="space-y-5">

      {/* Notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-[13px] font-medium text-amber-800">Ranking mensual únicamente</p>
        <p className="text-[12px] text-amber-700 mt-0.5">
          Ajusta los totales del mes de cada asesor. Las ventas registradas hoy con PIN no se modifican.
        </p>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700 font-medium">
          {successMsg}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-gray-400">
          {dirtyIds.length > 0
            ? `${dirtyIds.length} asesor${dirtyIds.length !== 1 ? 'es' : ''} con cambios`
            : 'Sin cambios pendientes'}
        </p>
        <button
          onClick={handleSave}
          disabled={dirtyIds.length === 0 || saving}
          className="inline-flex items-center gap-2 px-4 h-9 bg-accent text-white text-[13px] font-medium rounded-md hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : `Guardar${dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ''}`}
        </button>
      </div>

      {/* Advisor cards */}
      <div className="space-y-3">
        {asesores.map((asesor) => {
          const r     = rows[asesor.id] ?? { monto: '0', txn: '0', uds: '0' };
          const dirty = isDirty(asesor.id);
          const vm    = ventasMap[asesor.id];
          const pin   = {
            monto: vm?.totalVentas        ?? 0,
            txn:   vm?.totalTransacciones ?? 0,
            uds:   vm?.totalUnidades      ?? 0,
          };
          const hasPinData = pin.monto > 0 || pin.txn > 0 || pin.uds > 0;

          return (
            <div
              key={asesor.id}
              className={`border rounded-xl p-4 transition-colors ${dirty ? 'border-indigo-200 bg-indigo-50/20' : 'border-gray-200 bg-surface'}`}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {asesor.fotoBase64
                    ? <Image src={asesor.fotoBase64} alt={asesor.nombre} width={36} height={36} className="w-full h-full object-cover" />
                    : <span className="text-sm font-semibold text-gray-400">{asesor.nombre[0]}{asesor.apellido[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{asesor.nombre} {asesor.apellido}</p>
                  {hasPinData && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      PIN acum.:&nbsp;
                      {pin.monto > 0 ? formatCurrency(pin.monto) : '—'}
                      {pin.txn > 0 && ` · ${pin.txn} txn`}
                      {pin.uds > 0 && ` · ${pin.uds} uds`}
                    </p>
                  )}
                </div>
                {dirty && (
                  <button
                    onClick={() => resetRow(asesor.id)}
                    className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
                  >
                    Restablecer
                  </button>
                )}
              </div>

              {/* Editable fields — grand totals */}
              <div className="grid grid-cols-3 gap-2">
                {FIELDS.map(({ field, label, step }) => (
                  <div key={field}>
                    <label className="block text-[10px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                      {label}
                    </label>
                    <input
                      type="number"
                      value={r[field]}
                      onChange={(e) => updateRow(asesor.id, field, e.target.value)}
                      className={`w-full px-2.5 py-2 text-sm border rounded-lg outline-none focus:border-gray-900 text-gray-900 bg-surface transition-colors ${
                        dirty ? 'border-indigo-200' : 'border-gray-200'
                      }`}
                      min={0}
                      step={step}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              {dirty && (
                <p className="mt-2.5 text-[11px] text-indigo-500">
                  Modificado · el acumulado del mes se ajustará para reflejar este total
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
