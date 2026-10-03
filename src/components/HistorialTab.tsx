'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';
import { calcularMetas } from '@/lib/calcularMetas';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
}

interface VentaMesDoc {
  mes: string;
  asesorId: string;
  totalVentas: number;
  totalUnidades: number;
  totalTransacciones: number;
  acumuladoMes?: { monto: number; unidades: number; transacciones: number };
}

interface Meta {
  montoTotal: number;
  asesores?: Record<string, { diasLaborados: number }>;
}

type Indicador = 'todos' | 'monto' | 'txn' | 'uds' | 'upt' | 'avt' | 'pct';

const INDICADOR_LABELS: Record<Indicador, string> = {
  todos: 'Todos',
  monto: 'Monto',
  txn: 'Transacciones',
  uds: 'Unidades',
  upt: 'UPT',
  avt: 'AVT',
  pct: '% Cumplimiento',
};

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function nombreMes(mes: string) {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

interface Row {
  mes: string;
  asesorId: string;
  monto: number;
  txn: number;
  uds: number;
  avt: number | null;
  upt: number | null;
  metaMensual: number;
  pctMeta: number | null;
}

export default function HistorialTab() {
  const storeId = useStoreId();
  const mesEnCurso = mesActual();

  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [ventas, setVentas] = useState<VentaMesDoc[]>([]);
  const [metas, setMetas] = useState<Record<string, Meta>>({});
  const [loading, setLoading] = useState(true);

  const [filtroMes, setFiltroMes] = useState('todos');
  const [filtroAsesor, setFiltroAsesor] = useState('todos');
  const [indicador, setIndicador] = useState<Indicador>('monto');

  const [rangoDesde, setRangoDesde] = useState('');
  const [rangoHasta, setRangoHasta] = useState('');
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!storeId) return;
    return onSnapshot(collection(db, 'tiendas', storeId, 'asesores'), (snap) => {
      setAsesores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asesor)));
    });
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    return onSnapshot(collection(db, 'tiendas', storeId, 'ventasMes'), (snap) => {
      setVentas(snap.docs.map((d) => d.data() as VentaMesDoc));
      setLoading(false);
    });
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    return onSnapshot(collection(db, 'tiendas', storeId, 'metas'), (snap) => {
      const map: Record<string, Meta> = {};
      snap.docs.forEach((d) => { map[d.id] = d.data() as Meta; });
      setMetas(map);
    });
  }, [storeId]);

  const asesorIds = useMemo(() => asesores.map((a) => a.id), [asesores]);

  const asesorNombre = (id: string) => {
    const a = asesores.find((x) => x.id === id);
    return a ? `${a.nombre} ${a.apellido}` : 'Asesor eliminado';
  };

  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>();
    ventas.forEach((v) => set.add(v.mes));
    Object.keys(metas).forEach((m) => set.add(m));
    return Array.from(set).sort().reverse();
  }, [ventas, metas]);

  const rows: Row[] = useMemo(() => {
    return ventas.map((v) => {
      const totalVentas        = (v.totalVentas        ?? 0) + (v.acumuladoMes?.monto         ?? 0);
      const totalUnidades      = (v.totalUnidades      ?? 0) + (v.acumuladoMes?.unidades      ?? 0);
      const totalTransacciones = (v.totalTransacciones ?? 0) + (v.acumuladoMes?.transacciones ?? 0);
      const avt = totalTransacciones > 0 ? totalVentas / totalTransacciones : null;
      const upt = totalTransacciones > 0 ? totalUnidades / totalTransacciones : null;

      const metaMes = metas[v.mes];
      const metasMap = metaMes && asesorIds.length > 0
        ? calcularMetas(metaMes.montoTotal, asesorIds, metaMes.asesores ?? {})
        : {};
      const metaMensual = metasMap[v.asesorId]?.metaMensual ?? 0;
      const pctMeta = metaMensual > 0 ? (totalVentas / metaMensual) * 100 : null;

      return {
        mes: v.mes,
        asesorId: v.asesorId,
        monto: totalVentas,
        txn: totalTransacciones,
        uds: totalUnidades,
        avt,
        upt,
        metaMensual,
        pctMeta,
      };
    });
  }, [ventas, metas, asesorIds]);

  const filteredRows = useMemo(() => {
    const sortKey: keyof Row | null = indicador === 'todos' ? null : indicador === 'pct' ? 'pctMeta' : indicador;
    return rows
      .filter((r) => filtroMes === 'todos' || r.mes === filtroMes)
      .filter((r) => filtroAsesor === 'todos' || r.asesorId === filtroAsesor)
      .sort((a, b) => {
        if (a.mes !== b.mes) return b.mes.localeCompare(a.mes);
        if (sortKey === null) return asesorNombre(a.asesorId).localeCompare(asesorNombre(b.asesorId));
        const va = (a[sortKey] as number | null) ?? -Infinity;
        const vb = (b[sortKey] as number | null) ?? -Infinity;
        return vb - va;
      });
  }, [rows, filtroMes, filtroAsesor, indicador, asesores]);

  const totales = filteredRows.reduce(
    (acc, r) => ({ monto: acc.monto + r.monto, txn: acc.txn + r.txn, uds: acc.uds + r.uds }),
    { monto: 0, txn: 0, uds: 0 }
  );

  const mesesBorrables = mesesDisponibles.filter((m) => m !== mesEnCurso);

  const rangoValido = rangoDesde !== '' && rangoHasta !== '';
  const mesesEnRango = rangoValido
    ? mesesBorrables.filter((m) => {
        const [desde, hasta] = rangoDesde <= rangoHasta ? [rangoDesde, rangoHasta] : [rangoHasta, rangoDesde];
        return m >= desde && m <= hasta;
      })
    : [];
  const registrosEnRango = ventas.filter((v) => mesesEnRango.includes(v.mes));

  async function handleBorrar() {
    if (mesesEnRango.length === 0 || borrando) return;
    setBorrando(true);
    setErrorMsg('');
    try {
      for (const v of registrosEnRango) {
        await deleteDoc(doc(db, 'tiendas', storeId, 'ventasMes', `${v.mes}_${v.asesorId}`));
      }
      for (const m of mesesEnRango) {
        await deleteDoc(doc(db, 'tiendas', storeId, 'metas', m)).catch(() => {});
      }
      setSuccessMsg(
        `Historial eliminado: ${mesesEnRango.length} mes${mesesEnRango.length !== 1 ? 'es' : ''}, ${registrosEnRango.length} registro${registrosEnRango.length !== 1 ? 's' : ''}.`
      );
      setTimeout(() => setSuccessMsg(''), 4000);
      setConfirmarBorrado(false);
      setRangoDesde('');
      setRangoHasta('');
    } catch {
      setErrorMsg('No se pudo eliminar el historial. Intenta de nuevo.');
    }
    setBorrando(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700 font-medium">
          {successMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Mes</label>
          <select
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-900 text-gray-900 bg-surface capitalize"
          >
            <option value="todos">Todos los meses</option>
            {mesesDisponibles.map((m) => (
              <option key={m} value={m} className="capitalize">
                {nombreMes(m)}{m === mesEnCurso ? ' (actual)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Asesor</label>
          <select
            value={filtroAsesor}
            onChange={(e) => setFiltroAsesor(e.target.value)}
            className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-900 text-gray-900 bg-surface"
          >
            <option value="todos">Todos</option>
            {asesores.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Ordenar por indicador</label>
          <select
            value={indicador}
            onChange={(e) => setIndicador(e.target.value as Indicador)}
            className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-900 text-gray-900 bg-surface"
          >
            {(Object.keys(INDICADOR_LABELS) as Indicador[]).map((i) => (
              <option key={i} value={i}>{INDICADOR_LABELS[i]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      {filteredRows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">No hay registros para este filtro.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-medium text-gray-400">Mes</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-400">Asesor</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">Monto</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">Txn</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">Uds</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">UPT</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">AVT</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">Meta</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">% Cumpl.</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={`${r.mes}_${r.asesorId}`} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 text-gray-700 capitalize">{nombreMes(r.mes)}</td>
                    <td className="px-3 py-2 text-gray-900 font-medium">{asesorNombre(r.asesorId)}</td>
                    <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{formatCurrency(r.monto)}</td>
                    <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{r.txn}</td>
                    <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{r.uds}</td>
                    <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{r.upt !== null ? r.upt.toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{r.avt !== null ? formatCurrency(r.avt) : '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{r.metaMensual > 0 ? formatCurrency(r.metaMensual) : '—'}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${
                      r.pctMeta === null ? 'text-gray-400' : r.pctMeta >= 100 ? 'text-emerald-600' : r.pctMeta >= 80 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {r.pctMeta !== null ? `${r.pctMeta.toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                  <td className="px-3 py-2 text-gray-500" colSpan={2}>Total ({filteredRows.length})</td>
                  <td className="px-3 py-2 text-right text-gray-900 tabular-nums">{formatCurrency(totales.monto)}</td>
                  <td className="px-3 py-2 text-right text-gray-900 tabular-nums">{totales.txn}</td>
                  <td className="px-3 py-2 text-right text-gray-900 tabular-nums">{totales.uds}</td>
                  <td colSpan={3} />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Zona de administración: eliminar historial por fechas */}
      <div className="border border-rose-200 rounded-xl p-4 bg-rose-50/30">
        <p className="text-[13px] font-semibold text-rose-700">Eliminar historial por fechas</p>
        <p className="text-[12px] text-rose-600/80 mt-0.5 mb-4">
          Borra permanentemente las ventas y metas de los meses seleccionados. El mes en curso ({nombreMes(mesEnCurso)}) no se puede eliminar desde aquí.
        </p>

        {errorMsg && (
          <div className="mb-3 px-3 py-2 bg-rose-100 border border-rose-300 text-rose-700 text-[12px] rounded-md">
            {errorMsg}
          </div>
        )}

        {mesesBorrables.length === 0 ? (
          <p className="text-[12px] text-rose-600/70">No hay meses anteriores en el historial todavía.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-rose-600/80 mb-1.5 font-medium uppercase tracking-wide">Desde</label>
              <select
                value={rangoDesde}
                onChange={(e) => { setRangoDesde(e.target.value); setConfirmarBorrado(false); }}
                className="w-full px-2.5 py-2 text-sm border border-rose-200 rounded-lg outline-none focus:border-rose-500 text-gray-900 bg-surface capitalize"
              >
                <option value="">Selecciona un mes</option>
                {mesesBorrables.map((m) => (
                  <option key={m} value={m} className="capitalize">{nombreMes(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-rose-600/80 mb-1.5 font-medium uppercase tracking-wide">Hasta</label>
              <select
                value={rangoHasta}
                onChange={(e) => { setRangoHasta(e.target.value); setConfirmarBorrado(false); }}
                className="w-full px-2.5 py-2 text-sm border border-rose-200 rounded-lg outline-none focus:border-rose-500 text-gray-900 bg-surface capitalize"
              >
                <option value="">Selecciona un mes</option>
                {mesesBorrables.map((m) => (
                  <option key={m} value={m} className="capitalize">{nombreMes(m)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {rangoValido && (
          <div className="mt-4">
            {mesesEnRango.length === 0 ? (
              <p className="text-[12px] text-rose-600/70">No hay registros en ese rango.</p>
            ) : !confirmarBorrado ? (
              <button
                onClick={() => setConfirmarBorrado(true)}
                className="inline-flex items-center gap-2 px-4 h-9 bg-[#be123c] text-white text-[13px] font-medium rounded-md hover:bg-[#9f1239] transition-colors"
              >
                Eliminar {mesesEnRango.length} mes{mesesEnRango.length !== 1 ? 'es' : ''} ({registrosEnRango.length} registro{registrosEnRango.length !== 1 ? 's' : ''})
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] text-rose-700 font-medium">
                  ¿Confirmas eliminar {mesesEnRango.length} mes{mesesEnRango.length !== 1 ? 'es' : ''} de historial? Esta acción no se puede deshacer.
                </span>
                <button
                  onClick={() => setConfirmarBorrado(false)}
                  disabled={borrando}
                  className="text-[12px] px-3 h-7 rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBorrar}
                  disabled={borrando}
                  className="text-[12px] px-3 h-7 rounded-md bg-[#be123c] text-white font-medium hover:bg-[#9f1239] transition-colors disabled:opacity-40"
                >
                  {borrando ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
