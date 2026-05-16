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
  fotoBase64: string;
}

interface MetaAsesor {
  diasLaborados: number;
}

interface Meta {
  montoTotal: number;
  asesores: Record<string, MetaAsesor>;
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
  const [metaGuardada, setMetaGuardada] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);

  // Cargar asesores en tiempo real
  useEffect(() => {
    if (!storeId) return;
    const q = query(collection(db, 'tiendas', storeId, 'asesores'), orderBy('creadoEn', 'asc'));
    return onSnapshot(q, (snap) => {
      setAsesores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asesor)));
    });
  }, [storeId]);

  // Cargar meta del mes actual
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
      }
      setLoading(false);
    });
  }, [mes]);

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
    const meta: Meta = { montoTotal: monto, asesores: asesorData };
    try {
      await setDoc(doc(db, 'tiendas', storeId, 'metas', mes), { ...meta, actualizadoEn: serverTimestamp() });
      setMetaGuardada(meta);
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

  const metaPorAsesor = metaGuardada ? metaGuardada.montoTotal / asesores.length : 0;

  // Vista resumen (meta ya configurada)
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {asesores.map((a) => {
            const diasLab = metaGuardada.asesores[a.id]?.diasLaborados ?? 0;
            const metaDiaria = diasLab > 0 ? metaPorAsesor / diasLab : 0;
            return (
              <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-5">
                <p className="text-sm font-semibold text-gray-900">{a.nombre} {a.apellido}</p>
                <p className="text-xs text-gray-400 mb-4">{a.cargo}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Días laborados</span>
                    <span className="font-medium text-gray-900">{diasLab} días</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Meta mensual</span>
                    <span className="font-medium text-gray-900">{formatCurrency(metaPorAsesor)}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-gray-100 pt-2 mt-2">
                    <span className="text-gray-500">Meta diaria</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(metaDiaria)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Formulario de configuración
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

      {/* Preview en tiempo real */}
      {montoTotal && Number(montoTotal) > 0 && asesores.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Vista previa</p>
          <p className="text-xs text-gray-600">Meta por asesor: <span className="font-semibold text-gray-900">{formatCurrency(Number(montoTotal) / asesores.length)}</span></p>
        </div>
      )}

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
