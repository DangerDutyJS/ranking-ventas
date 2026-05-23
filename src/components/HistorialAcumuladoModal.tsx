'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, increment, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';
import { crearNotificacion } from '@/lib/notificaciones';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
}

interface Entrada {
  id: string;
  monto: number;
  transacciones: number;
  unidades: number;
  fecha: string;
  creadoEn: string;
}

interface Props {
  asesor: Asesor;
  onClose: () => void;
}

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function fechaHoy() {
  return new Date().toLocaleDateString('fr-CA');
}

export default function HistorialAcumuladoModal({ asesor, onClose }: Props) {
  const storeId = useStoreId();
  const mes = mesActual();
  const parentId = `${mes}_${asesor.id}`;
  const parentRef = doc(db, 'tiendas', storeId, 'ventasMes', parentId);

  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [monto, setMonto] = useState('');
  const [txn, setTxn] = useState('');
  const [uds, setUds] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editMonto, setEditMonto] = useState('');
  const [editTxn, setEditTxn] = useState('');
  const [editUds, setEditUds] = useState('');

  useEffect(() => {
    return onSnapshot(parentRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const lista: Entrada[] = (data.acumulados ?? []).slice().reverse();
        setEntradas(lista);
      } else {
        setEntradas([]);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, parentId]);

  const handleAgregar = async () => {
    const m = parseFloat(monto) || 0;
    const t = parseInt(txn) || 0;
    const u = parseInt(uds) || 0;
    if (m <= 0 && t <= 0 && u <= 0) { setError('Ingresa al menos un valor.'); return; }
    setSaving(true);
    setError('');
    const entrada: Entrada = {
      id: crypto.randomUUID(),
      monto: m, transacciones: t, unidades: u,
      fecha: fechaHoy(), creadoEn: new Date().toISOString(),
    };
    try {
      const snap = await getDoc(parentRef);
      if (snap.exists()) {
        await updateDoc(parentRef, {
          'acumuladoMes.monto': increment(m),
          'acumuladoMes.transacciones': increment(t),
          'acumuladoMes.unidades': increment(u),
          acumulados: arrayUnion(entrada),
        });
      } else {
        await setDoc(parentRef, {
          mes, asesorId: asesor.id,
          acumuladoMes: { monto: m, transacciones: t, unidades: u },
          acumulados: [entrada],
        });
      }
      setMonto(''); setTxn(''); setUds('');
      setShowForm(false);
      const partes = [
        m > 0 ? formatCurrency(m) : '',
        t > 0 ? `${t} txn` : '',
        u > 0 ? `${u} uds` : '',
      ].filter(Boolean).join(' · ');
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Agregó acumulado: ${partes}`);
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    }
    setSaving(false);
  };

  const handleEliminar = async (entrada: Entrada) => {
    try {
      const snap = await getDoc(parentRef);
      if (!snap.exists()) return;
      const todos: Entrada[] = snap.data().acumulados ?? [];
      const filtered = todos.filter((e) => e.id !== entrada.id);
      await updateDoc(parentRef, {
        acumulados: filtered,
        'acumuladoMes.monto': increment(-entrada.monto),
        'acumuladoMes.transacciones': increment(-entrada.transacciones),
        'acumuladoMes.unidades': increment(-entrada.unidades),
      });
      const partes = [
        entrada.monto > 0 ? formatCurrency(entrada.monto) : '',
        entrada.transacciones > 0 ? `${entrada.transacciones} txn` : '',
        entrada.unidades > 0 ? `${entrada.unidades} uds` : '',
      ].filter(Boolean).join(' · ');
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Eliminó acumulado: ${partes}`);
    } catch { /* silent */ }
  };

  const startEdit = (entrada: Entrada) => {
    setEditId(entrada.id);
    setEditMonto(String(entrada.monto || ''));
    setEditTxn(String(entrada.transacciones || ''));
    setEditUds(String(entrada.unidades || ''));
  };

  const handleGuardarEdit = async (entrada: Entrada) => {
    const m = parseFloat(editMonto) || 0;
    const t = parseInt(editTxn) || 0;
    const u = parseInt(editUds) || 0;
    try {
      const snap = await getDoc(parentRef);
      if (!snap.exists()) return;
      const todos: Entrada[] = snap.data().acumulados ?? [];
      const idx = todos.findIndex((e) => e.id === entrada.id);
      if (idx === -1) return;
      const updated = [...todos];
      updated[idx] = { ...entrada, monto: m, transacciones: t, unidades: u };
      await updateDoc(parentRef, {
        acumulados: updated,
        'acumuladoMes.monto': increment(m - entrada.monto),
        'acumuladoMes.transacciones': increment(t - entrada.transacciones),
        'acumuladoMes.unidades': increment(u - entrada.unidades),
      });
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Editó acumulado: ${formatCurrency(entrada.monto)} → ${formatCurrency(m)}` +
        (t !== entrada.transacciones ? ` · ${t} txn` : '') +
        (u !== entrada.unidades ? ` · ${u} uds` : ''));
      setEditId(null);
    } catch { /* silent */ }
  };

  const total = entradas.reduce(
    (acc, e) => ({ monto: acc.monto + e.monto, transacciones: acc.transacciones + e.transacciones, unidades: acc.unidades + e.unidades }),
    { monto: 0, transacciones: 0, unidades: 0 }
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm flex flex-col max-h-[85vh] animate-modal">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Acumulado del mes</p>
            <p className="text-base font-semibold text-gray-900">{asesor.nombre} {asesor.apellido}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Total */}
        {entradas.length > 0 && (
          <div className="mx-6 mb-3 bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">Total acumulado</span>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
              {total.monto > 0 && <span>{formatCurrency(total.monto)}</span>}
              {total.transacciones > 0 && <span className="text-gray-500 font-normal">· {total.transacciones} txn</span>}
              {total.unidades > 0 && <span className="text-gray-500 font-normal">· {total.unidades} uds</span>}
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 space-y-2 min-h-0">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : entradas.length === 0 && !showForm ? (
            <p className="text-sm text-gray-400 text-center py-6">No hay entradas aún.</p>
          ) : entradas.map((entrada) => (
            <div key={entrada.id} className="border border-gray-100 rounded-xl px-3 py-3">
              {editId === entrada.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Monto', val: editMonto, set: setEditMonto },
                      { label: 'Txn', val: editTxn, set: setEditTxn },
                      { label: 'Uds', val: editUds, set: setEditUds },
                    ].map(({ label, val, set }) => (
                      <div key={label}>
                        <label className="block text-[10px] text-gray-400 mb-0.5">{label}</label>
                        <input type="number" value={val} onChange={(e) => set(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-gray-900 text-gray-900" min={0} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditId(null)}
                      className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button onClick={() => handleGuardarEdit(entrada)}
                      className="flex-1 text-xs text-white bg-gray-900 rounded-lg py-1.5 hover:bg-gray-700">
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">{entrada.fecha}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {entrada.monto > 0 && <span className="text-sm font-semibold text-gray-900">{formatCurrency(entrada.monto)}</span>}
                      {entrada.transacciones > 0 && <span className="text-xs text-gray-500">{entrada.transacciones} txn</span>}
                      {entrada.unidades > 0 && <span className="text-xs text-gray-500">{entrada.unidades} uds</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => startEdit(entrada)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleEliminar(entrada)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Formulario nueva entrada */}
        <div className="p-6 pt-4 space-y-3">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-3 space-y-3">
              <p className="text-xs font-medium text-gray-600">Nueva entrada</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monto</label>
                <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 text-gray-900"
                  placeholder="Ej. 500000" min={0} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Transacciones</label>
                  <input type="number" value={txn} onChange={(e) => setTxn(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 text-gray-900"
                    placeholder="0" min={0} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unidades</label>
                  <input type="number" value={uds} onChange={(e) => setUds(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 text-gray-900"
                    placeholder="0" min={0} />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setError(''); }}
                  className="flex-1 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleAgregar} disabled={saving}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors">
              + Agregar entrada
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
