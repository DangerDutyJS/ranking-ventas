'use client';

import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, orderBy, query, setDoc, serverTimestamp } from 'firebase/firestore';
import { calcularMetas } from '@/lib/calcularMetas';
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
  metaAVT?: number;
  metaUPT?: number;
  metaTransacciones?: number;
  metaUnidades?: number;
}

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
  const [metaAVT, setMetaAVT] = useState('');
  const [metaUPT, setMetaUPT] = useState('');
  const [metaTransacciones, setMetaTransacciones] = useState('');
  const [metaUnidades, setMetaUnidades] = useState('');
  const [metaGuardada, setMetaGuardada] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);

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
        setMetaAVT(data.metaAVT ? String(data.metaAVT) : '');
        setMetaUPT(data.metaUPT ? String(data.metaUPT) : '');
        setMetaTransacciones(data.metaTransacciones ? String(data.metaTransacciones) : '');
        setMetaUnidades(data.metaUnidades ? String(data.metaUnidades) : '');
      }
      setLoading(false);
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
      ...(Number(metaAVT) > 0 && { metaAVT: Number(metaAVT) }),
      ...(Number(metaUPT) > 0 && { metaUPT: parseFloat(metaUPT) }),
      ...(Number(metaTransacciones) > 0 && { metaTransacciones: Number(metaTransacciones) }),
      ...(Number(metaUnidades) > 0 && { metaUnidades: Number(metaUnidades) }),
    };
    try {
      await setDoc(doc(db, 'tiendas', storeId, 'metas', mes), { ...metaObj, actualizadoEn: serverTimestamp() });
      setMetaGuardada(metaObj);
      setEditando(false);
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    }
    setSaving(false);
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

  const metasMap = metaGuardada && asesores.length > 0
    ? calcularMetas(metaGuardada.montoTotal, asesores.map((a) => a.id), metaGuardada.asesores)
    : {};

  if (metaGuardada && !editando) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Monto total del mes</p>
            <p className="text-2xl font-semibold text-gray-900 mt-0.5">{formatCurrency(metaGuardada.montoTotal)}</p>
          </div>
          <button onClick={() => setEditando(true)}
            className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            Editar
          </button>
        </div>

        {/* Presupuesto por asesor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {asesores.map((a) => {
            const mc = metasMap[a.id];
            const diasLab = mc?.diasLaborados ?? 0;
            const metaDiaria = diasLab > 0 && mc ? mc.metaMensual / diasLab : 0;
            return (
              <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-5">
                <p className="text-sm font-semibold text-gray-900">{a.nombre} {a.apellido}</p>
                <p className="text-xs text-gray-400 mb-4">{a.cargo}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Días laborados</span>
                    <span className="font-medium text-gray-900">{diasLab} / {mc?.diasMes ?? 0} días</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Presupuesto base</span>
                    <span className="font-medium text-gray-500">{mc ? formatCurrency(mc.presupuestoBase) : '—'}</span>
                  </div>
                  {mc?.esProporcional && (
                    <div className="flex justify-between text-xs">
                      <span className="text-orange-500">Ajuste proporcional</span>
                      <span className="font-medium text-orange-500">{mc ? formatCurrency(mc.redistribucion) : '—'}</span>
                    </div>
                  )}
                  {!mc?.esProporcional && mc && mc.redistribucion > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-500">+ Redistribución</span>
                      <span className="font-medium text-blue-500">+{formatCurrency(mc.redistribucion)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs border-t border-gray-100 pt-2 mt-2">
                    <span className="text-gray-700 font-semibold">Meta mensual</span>
                    <span className="font-bold text-gray-900">{mc ? formatCurrency(mc.metaMensual) : '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Meta diaria</span>
                    <span className="font-semibold text-gray-900">{metaDiaria > 0 ? formatCurrency(metaDiaria) : '—'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Indicadores de gestión */}
        {(metaGuardada.metaAVT || metaGuardada.metaUPT || metaGuardada.metaTransacciones || metaGuardada.metaUnidades) && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Indicadores de gestión</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {metaGuardada.metaAVT && (
                <div>
                  <p className="text-xs text-gray-400">Meta AVT (c/IVA)</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatCurrency(metaGuardada.metaAVT)}</p>
                  <p className="text-xs text-gray-400">s/IVA: {formatCurrency(metaGuardada.metaAVT / 1.19)}</p>
                </div>
              )}
              {metaGuardada.metaUPT && (
                <div>
                  <p className="text-xs text-gray-400">Meta UPT</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{metaGuardada.metaUPT.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">uds / transacción</p>
                </div>
              )}
              {metaGuardada.metaTransacciones && (
                <div>
                  <p className="text-xs text-gray-400">Meta Transacciones</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{metaGuardada.metaTransacciones}</p>
                  <p className="text-xs text-gray-400">por mes</p>
                </div>
              )}
              {metaGuardada.metaUnidades && (
                <div>
                  <p className="text-xs text-gray-400">Meta Unidades</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{metaGuardada.metaUnidades}</p>
                  <p className="text-xs text-gray-400">por mes</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleGuardar} className="space-y-6 max-w-lg" autoComplete="off">
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-600">Días laborados por asesor</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Mismo para todos"
              min={1}
              max={31}
              className="w-36 px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-gray-900 transition-colors text-gray-900 text-center"
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

      {/* Vista previa distribución */}
      {montoTotal && Number(montoTotal) > 0 && asesores.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
          <p className="text-xs font-medium text-gray-500 mb-2">Vista previa presupuesto</p>
          {(() => {
            const monto = Number(montoTotal);
            const diasInput: Record<string, { diasLaborados: number }> = {};
            asesores.forEach((a) => { diasInput[a.id] = { diasLaborados: Number(dias[a.id] ?? 0) }; });
            const preview = calcularMetas(monto, asesores.map((a) => a.id), diasInput);
            return asesores.map((a) => {
              const mc = preview[a.id];
              if (!mc) return null;
              return (
                <div key={a.id} className="flex justify-between text-xs">
                  <span className="text-gray-500 truncate max-w-[140px]">{a.nombre}</span>
                  <span className={`font-semibold ${mc.esProporcional ? 'text-orange-600' : mc.redistribucion > 0 ? 'text-blue-600' : 'text-gray-900'}`}>
                    {formatCurrency(mc.metaMensual)}
                    {mc.esProporcional && ' ↓'}
                    {!mc.esProporcional && mc.redistribucion > 0 && ' ↑'}
                  </span>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Indicadores de gestión */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-600">
          Indicadores de gestión <span className="text-gray-400 font-normal">(opcional)</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Meta AVT ($ con IVA)</label>
            <input
              type="number"
              value={metaAVT}
              onChange={(e) => setMetaAVT(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
              placeholder="Ej. 150000"
              min={0}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Meta UPT</label>
            <input
              type="number"
              step="0.1"
              value={metaUPT}
              onChange={(e) => setMetaUPT(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
              placeholder="Ej. 3.5"
              min={0}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Meta transacciones / mes</label>
            <input
              type="number"
              value={metaTransacciones}
              onChange={(e) => setMetaTransacciones(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
              placeholder="Ej. 60"
              min={0}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Meta unidades / mes</label>
            <input
              type="number"
              value={metaUnidades}
              onChange={(e) => setMetaUnidades(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
              placeholder="Ej. 200"
              min={0}
            />
          </div>
        </div>
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
