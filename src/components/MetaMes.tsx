'use client';

import { useEffect, useState } from 'react';
import { collection, doc, getDocs, getDoc, onSnapshot, orderBy, query, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { calcularMetas, distribuirIndicador } from '@/lib/calcularMetas';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  cargo: string;
  fotoBase64: string;
}

interface MetaAsesor {
  diasLaborados: number;
}

interface Meta {
  montoTotal: number;
  asesores: Record<string, MetaAsesor>;
  metaTransacciones?: number;
  metaUnidades?: number;
  metaUPT?: number;
  metaAVT?: number;
}

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMes(mes: string): string {
  const [year, month] = mes.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export default function MetaMes() {
  const storeId = useStoreId();
  const mes = mesActual();

  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [montoTotal, setMontoTotal] = useState('');
  const [dias, setDias] = useState<Record<string, string>>({});
  const [metaTransacciones, setMetaTransacciones] = useState('');
  const [metaUnidades, setMetaUnidades] = useState('');
  const [metaUPT, setMetaUPT] = useState('');
  const [metaAVT, setMetaAVT] = useState('');
  const [metaGuardada, setMetaGuardada] = useState<Meta | null>(null);
  const [historial, setHistorial] = useState<Array<{ mes: string; data: Meta }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      if (snap.exists()) {
        const data = snap.data() as Meta;
        setMetaGuardada(data);
        setMontoTotal(String(data.montoTotal));
        const diasInit: Record<string, string> = {};
        for (const [id, val] of Object.entries(data.asesores)) {
          diasInit[id] = String(val.diasLaborados);
        }
        setDias(diasInit);
        setMetaTransacciones(data.metaTransacciones ? String(data.metaTransacciones) : '');
        setMetaUnidades(data.metaUnidades ? String(data.metaUnidades) : '');
        setMetaUPT(data.metaUPT ? String(data.metaUPT) : '');
        setMetaAVT(data.metaAVT ? String(data.metaAVT) : '');
      }
      setLoading(false);
    });
    getDocs(collection(db, 'tiendas', storeId, 'metas')).then((snap) => {
      const all = snap.docs
        .map((d) => ({ mes: d.id, data: d.data() as Meta }))
        .sort((a, b) => b.mes.localeCompare(a.mes));
      setHistorial(all);
    });
  }, [storeId, mes]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const monto = Number(montoTotal.replace(/\D/g, ''));
    if (!monto || monto <= 0) return setError('Ingresa un monto válido.');
    for (const a of asesores) {
      if (!dias[a.id] || Number(dias[a.id]) <= 0) return setError(`Ingresa los días laborados de ${a.nombre}.`);
    }
    setSaving(true);
    const asesorData: Record<string, MetaAsesor> = {};
    for (const a of asesores) {
      asesorData[a.id] = { diasLaborados: Number(dias[a.id]) };
    }
    const metaObj: Meta = {
      montoTotal: monto,
      asesores: asesorData,
      ...(Number(metaTransacciones) > 0 && { metaTransacciones: Number(metaTransacciones) }),
      ...(Number(metaUnidades) > 0 && { metaUnidades: Number(metaUnidades) }),
      ...(Number(metaUPT) > 0 && { metaUPT: Number(metaUPT) }),
      ...(Number(metaAVT) > 0 && { metaAVT: Number(metaAVT) }),
    };
    try {
      await setDoc(
        doc(db, 'tiendas', storeId, 'metas', mes),
        { ...metaObj, actualizadoEn: serverTimestamp() },
        { merge: true }
      );
      setMetaGuardada(metaObj);
      setHistorial((prev) => {
        const filtered = prev.filter((h) => h.mes !== mes);
        return [{ mes, data: metaObj }, ...filtered].sort((a, b) => b.mes.localeCompare(a.mes));
      });
      setEditando(false);
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'tiendas', storeId, 'metas', mes));
      setMetaGuardada(null);
      setEditando(false);
      setConfirmDelete(false);
    } catch {
      setError('Error al eliminar. Intenta de nuevo.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (asesores.length === 0) {
    return <p className="text-sm text-gray-400 py-12 text-center">Registra asesores primero para configurar la meta.</p>;
  }

  const asesorIds = asesores.map((a) => a.id);
  const metasMap = metaGuardada
    ? calcularMetas(metaGuardada.montoTotal, asesorIds, metaGuardada.asesores)
    : {};
  const txnPorAsesor = metaGuardada?.metaTransacciones
    ? distribuirIndicador(metaGuardada.metaTransacciones, asesorIds, metaGuardada.asesores)
    : {};
  const udsPorAsesor = metaGuardada?.metaUnidades
    ? distribuirIndicador(metaGuardada.metaUnidades, asesorIds, metaGuardada.asesores)
    : {};

  // ── VISTA ────────────────────────────────────────────────────────────────
  if (metaGuardada && !editando) {
    const mesNombre = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const pastMonths = historial.filter((h) => h.mes !== mes);
    const derivedUPT = metaGuardada.metaTransacciones && metaGuardada.metaTransacciones > 0 && metaGuardada.metaUnidades
      ? metaGuardada.metaUnidades / metaGuardada.metaTransacciones : null;
    const derivedAVT = metaGuardada.metaTransacciones && metaGuardada.metaTransacciones > 0
      ? metaGuardada.montoTotal / metaGuardada.metaTransacciones : null;
    const displayUPT = metaGuardada.metaUPT ?? derivedUPT;
    const displayAVT = metaGuardada.metaAVT ?? derivedAVT;
    const uptEsManual = !!metaGuardada.metaUPT;
    const avtEsManual = !!metaGuardada.metaAVT;

    return (
      <div className="space-y-6">
        {/* Header mes actual */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide capitalize">{mesNombre}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-0.5">{formatCurrency(metaGuardada.montoTotal)}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {metaGuardada.metaTransacciones && (
                <span className="text-xs text-gray-500">{metaGuardada.metaTransacciones} txn</span>
              )}
              {metaGuardada.metaUnidades && (
                <span className="text-xs text-gray-500">{metaGuardada.metaUnidades} uds</span>
              )}
              {displayUPT !== null && (
                <span className="text-xs text-gray-500">UPT {displayUPT.toFixed(2)}{uptEsManual ? '' : ' *'}</span>
              )}
              {displayAVT !== null && (
                <span className="text-xs text-gray-500">AVT {formatCurrency(displayAVT)}{avtEsManual ? '' : ' *'}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-xs text-gray-500">¿Eliminar meta?</span>
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                  No
                </button>
                <button type="button" onClick={handleDelete}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                  Sí, eliminar
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setEditando(true)}
                  className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                  Editar
                </button>
                <button type="button" onClick={() => setConfirmDelete(true)}
                  className="text-sm text-red-400 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors">
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tarjetas por asesor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {asesores.map((a) => {
            const mc  = metasMap[a.id];
            const txn = txnPorAsesor[a.id];
            const uds = udsPorAsesor[a.id];
            return (
              <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-5">
                <p className="text-sm font-semibold text-gray-900">{a.nombre} {a.apellido}</p>
                <p className="text-xs text-gray-400 mb-4">{a.cargo}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Días laborados</span>
                    <span className="font-medium text-gray-900">{mc?.diasLaborados ?? 0} días</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-gray-100 pt-2">
                    <span className="text-gray-700 font-semibold">Meta mensual</span>
                    <span className="font-bold text-gray-900">{mc ? formatCurrency(mc.metaMensual) : '—'}</span>
                  </div>
                  {txn !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Txn / mes</span>
                      <span className="font-medium text-gray-900">{Math.round(txn)}</span>
                    </div>
                  )}
                  {uds !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Unidades / mes</span>
                      <span className="font-medium text-gray-900">{Math.round(uds)}</span>
                    </div>
                  )}
                  {displayUPT !== null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">UPT{uptEsManual ? '' : ' *'}</span>
                      <span className="font-medium text-gray-900">{displayUPT.toFixed(2)}</span>
                    </div>
                  )}
                  {displayAVT !== null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">AVT{avtEsManual ? '' : ' *'}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(displayAVT)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Historial de meses anteriores */}
        {pastMonths.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Historial</p>
            <div className="space-y-2">
              {pastMonths.map(({ mes: m, data }) => {
                const hUPT = data.metaUPT
                  ?? (data.metaTransacciones && data.metaTransacciones > 0 && data.metaUnidades
                    ? data.metaUnidades / data.metaTransacciones : null);
                const hAVT = data.metaAVT
                  ?? (data.metaTransacciones && data.metaTransacciones > 0
                    ? data.montoTotal / data.metaTransacciones : null);
                return (
                  <div key={m} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{formatMes(m)}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {data.metaTransacciones && (
                          <span className="text-xs text-gray-400">{data.metaTransacciones} txn</span>
                        )}
                        {data.metaUnidades && (
                          <span className="text-xs text-gray-400">{data.metaUnidades} uds</span>
                        )}
                        {hUPT !== null && (
                          <span className="text-xs text-gray-400">UPT {hUPT.toFixed(2)}</span>
                        )}
                        {hAVT !== null && (
                          <span className="text-xs text-gray-400">AVT {formatCurrency(hAVT)}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(data.montoTotal)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── FORMULARIO ────────────────────────────────────────────────────────────
  const mesNombreForm = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  return (
    <form onSubmit={handleGuardar} className="space-y-6 max-w-lg" autoComplete="off">
      <p className="text-sm text-gray-500 capitalize">{mesNombreForm}</p>

      {/* Monto total */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Monto total del mes</label>
        <input
          type="number"
          value={montoTotal}
          onChange={(e) => setMontoTotal(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
          placeholder="Ej. 50000000"
          min={1}
        />
      </div>

      {/* Indicadores del mes */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Meta transacciones</label>
          <input
            type="number"
            value={metaTransacciones}
            onChange={(e) => setMetaTransacciones(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
            placeholder="Ej. 120"
            min={0}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Meta unidades</label>
          <input
            type="number"
            value={metaUnidades}
            onChange={(e) => setMetaUnidades(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
            placeholder="Ej. 400"
            min={0}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Meta UPT
            {Number(metaTransacciones) > 0 && Number(metaUnidades) > 0 && !Number(metaUPT) && (
              <span className="ml-1.5 text-gray-400 font-normal">
                (auto: {(Number(metaUnidades) / Number(metaTransacciones)).toFixed(2)})
              </span>
            )}
          </label>
          <input
            type="number"
            value={metaUPT}
            onChange={(e) => setMetaUPT(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
            placeholder="Dejar vacío = auto"
            min={0}
            step={0.01}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Meta AVT
            {Number(metaTransacciones) > 0 && Number(montoTotal) > 0 && !Number(metaAVT) && (
              <span className="ml-1.5 text-gray-400 font-normal">
                (auto: {formatCurrency(Number(montoTotal) / Number(metaTransacciones))})
              </span>
            )}
          </label>
          <input
            type="number"
            value={metaAVT}
            onChange={(e) => setMetaAVT(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
            placeholder="Dejar vacío = auto"
            min={0}
          />
        </div>
      </div>

      {/* Días laborados */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-600">Días laborados por asesor</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Igual para todos"
              min={1}
              max={31}
              className="w-32 px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-gray-900 transition-colors text-gray-900 text-center"
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const todos: Record<string, string> = {};
                asesores.forEach((a) => { todos[a.id] = val; });
                setDias(todos);
              }}
            />
            <span className="text-xs text-gray-400">días</span>
          </div>
        </div>
        {asesores.map((a) => (
          <div key={a.id} className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{a.nombre} {a.apellido}</p>
              <p className="text-xs text-gray-400">{a.cargo}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={dias[a.id] ?? ''}
                onChange={(e) => setDias((prev) => ({ ...prev, [a.id]: e.target.value }))}
                className="w-16 px-2 py-1.5 text-sm text-center border border-gray-200 rounded-lg outline-none focus:border-gray-900 transition-colors text-gray-900"
                placeholder="0"
                min={1}
                max={31}
              />
              <span className="text-xs text-gray-400">días</span>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        {editando && (
          <button type="button" onClick={() => setEditando(false)}
            className="flex-1 px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={saving}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar meta'}
        </button>
      </div>
    </form>
  );
}
