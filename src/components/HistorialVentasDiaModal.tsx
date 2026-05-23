'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';
import { crearNotificacion } from '@/lib/notificaciones';
import Image from 'next/image';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  fotoBase64: string;
}

interface Registro {
  id?: string;
  monto: number;
  unidades: number;
  transacciones: number;
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

function fechaHoy() {
  return new Date().toLocaleDateString('fr-CA');
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function formatHora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function entryKey(r: Registro) {
  return r.id ?? r.creadoEn;
}

export default function HistorialVentasDiaModal({ asesor, onClose }: Props) {
  const storeId = useStoreId();
  const mes = mesActual();
  const hoy = fechaHoy();
  const docId = `${mes}_${asesor.id}`;
  const docRef = doc(db, 'tiendas', storeId, 'ventasMes', docId);

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [monto, setMonto] = useState('');
  const [unidades, setUnidades] = useState('');
  const [txn, setTxn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editEntry, setEditEntry] = useState<Registro | null>(null);
  const [editMonto, setEditMonto] = useState('');
  const [editUds, setEditUds] = useState('');
  const [editTxn, setEditTxn] = useState('');

  useEffect(() => {
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const hoyRegs: Registro[] = (data.registros ?? [])
          .filter((r: Registro) => r.fecha === hoy)
          .slice()
          .reverse();
        setRegistros(hoyRegs);
      } else {
        setRegistros([]);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, docId]);

  const handleAgregar = async () => {
    const m = Number(monto.replace(/\D/g, ''));
    const u = parseInt(unidades);
    const t = parseInt(txn);
    if (!m || m <= 0) { setError('Ingresa un monto válido.'); return; }
    if (!u || u <= 0) { setError('Ingresa las unidades (entero).'); return; }
    if (!t || t <= 0) { setError('Ingresa las transacciones (entero).'); return; }
    setSaving(true);
    setError('');
    const registro: Registro = {
      id: crypto.randomUUID(),
      monto: m, unidades: u, transacciones: t,
      fecha: hoy, creadoEn: new Date().toISOString(),
    };
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await updateDoc(docRef, {
          totalVentas: increment(m),
          totalUnidades: increment(u),
          totalTransacciones: increment(t),
          registros: arrayUnion(registro),
        });
      } else {
        await setDoc(docRef, {
          mes, asesorId: asesor.id,
          totalVentas: m, totalUnidades: u, totalTransacciones: t,
          registros: [registro],
        });
      }
      setMonto(''); setUnidades(''); setTxn('');
      setShowForm(false);
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Registró venta: ${formatCurrency(m)} · ${t} txn · ${u} uds`);
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    }
    setSaving(false);
  };

  const handleEliminar = async (registro: Registro) => {
    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      const todos: Registro[] = snap.data().registros ?? [];
      const filtered = todos.filter((r) => entryKey(r) !== entryKey(registro));
      await updateDoc(docRef, {
        registros: filtered,
        totalVentas: increment(-registro.monto),
        totalUnidades: increment(-registro.unidades),
        totalTransacciones: increment(-registro.transacciones),
      });
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Eliminó venta de ${formatCurrency(registro.monto)} (${registro.transacciones} txn · ${registro.unidades} uds)`);
    } catch { /* silent */ }
  };

  const startEdit = (r: Registro) => {
    setEditEntry(r);
    setEditMonto(String(r.monto));
    setEditUds(String(r.unidades));
    setEditTxn(String(r.transacciones));
    setShowForm(false);
  };

  const handleGuardarEdit = async () => {
    if (!editEntry) return;
    const m = parseFloat(editMonto) || 0;
    const u = parseInt(editUds) || 0;
    const t = parseInt(editTxn) || 0;
    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      const todos: Registro[] = snap.data().registros ?? [];
      const idx = todos.findIndex((r) => entryKey(r) === entryKey(editEntry));
      if (idx === -1) return;
      const updated = [...todos];
      updated[idx] = { ...editEntry, monto: m, unidades: u, transacciones: t };
      await updateDoc(docRef, {
        registros: updated,
        totalVentas: increment(m - editEntry.monto),
        totalUnidades: increment(u - editEntry.unidades),
        totalTransacciones: increment(t - editEntry.transacciones),
      });
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Editó venta: ${formatCurrency(editEntry.monto)} → ${formatCurrency(m)} · ${t} txn · ${u} uds`);
      setEditEntry(null);
    } catch { /* silent */ }
  };

  const total = registros.reduce(
    (acc, r) => ({ monto: acc.monto + r.monto, unidades: acc.unidades + r.unidades, transacciones: acc.transacciones + r.transacciones }),
    { monto: 0, unidades: 0, transacciones: 0 }
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm flex flex-col max-h-[85vh] animate-modal">

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {asesor.fotoBase64 ? (
                <Image src={asesor.fotoBase64} alt={asesor.nombre} width={40} height={40} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-gray-400">{asesor.nombre[0]}{asesor.apellido[0]}</span>
              )}
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">{asesor.nombre} {asesor.apellido}</p>
              <p className="text-xs text-gray-400">Ventas del día · {hoy}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Total del día */}
        {registros.length > 0 && (
          <div className="mx-6 mb-3 bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">Total hoy</span>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
              {total.monto > 0 && <span>{formatCurrency(total.monto)}</span>}
              {total.transacciones > 0 && <span className="text-gray-500 font-normal">· {total.transacciones} txn</span>}
              {total.unidades > 0 && <span className="text-gray-500 font-normal">· {total.unidades} uds</span>}
            </div>
          </div>
        )}

        {/* Lista registros */}
        <div className="flex-1 overflow-y-auto px-6 space-y-2 min-h-0">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : registros.length === 0 && !showForm ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin registros hoy.</p>
          ) : registros.map((r) => {
            const key = entryKey(r);
            const isEditing = editEntry && entryKey(editEntry) === key;
            return (
              <div key={key} className="border border-gray-100 rounded-xl px-3 py-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { label: 'Monto', val: editMonto, set: setEditMonto },
                        { label: 'Uds', val: editUds, set: setEditUds },
                        { label: 'Txn', val: editTxn, set: setEditTxn },
                      ] as const).map(({ label, val, set }) => (
                        <div key={label}>
                          <label className="block text-[10px] text-gray-400 mb-0.5">{label}</label>
                          <input type="number" value={val}
                            onChange={(e) => (set as (v: string) => void)(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-gray-900 text-gray-900" min={1} />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditEntry(null)}
                        className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">
                        Cancelar
                      </button>
                      <button onClick={handleGuardarEdit}
                        className="flex-1 text-xs text-white bg-gray-900 rounded-lg py-1.5 hover:bg-gray-700">
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">{formatHora(r.creadoEn)}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(r.monto)}</span>
                        <span className="text-xs text-gray-500">{r.transacciones} txn</span>
                        <span className="text-xs text-gray-500">{r.unidades} uds</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => startEdit(r)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleEliminar(r)}
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
            );
          })}
        </div>

        {/* Formulario / botón agregar */}
        <div className="p-6 pt-4 space-y-3">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-3 space-y-3">
              <p className="text-xs font-medium text-gray-600">Nueva venta</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monto vendido</label>
                <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 text-gray-900"
                  placeholder="Ej. 2500000" min={1} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unidades</label>
                  <input type="number" value={unidades} onChange={(e) => setUnidades(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 text-gray-900"
                    placeholder="Ej. 5" min={1} step={1} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Transacciones</label>
                  <input type="number" value={txn} onChange={(e) => setTxn(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 text-gray-900"
                    placeholder="Ej. 2" min={1} step={1} />
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
                  {saving ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setShowForm(true); setEditEntry(null); }}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors">
              + Registrar venta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
