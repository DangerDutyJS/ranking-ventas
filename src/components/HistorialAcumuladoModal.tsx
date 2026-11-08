'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, increment, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';
import { crearNotificacion } from '@/lib/notificaciones';
import Image from 'next/image';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  fotoBase64?: string;
}

interface Entrada {
  id: string;
  monto: number;
  transacciones: number;
  unidades: number;
  fecha: string;
  creadoEn: string;
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function fechaHoy() {
  return new Date().toLocaleDateString('fr-CA');
}

function formatHora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function regKey(r: Registro) {
  return r.id ?? r.creadoEn;
}

export default function HistorialAcumuladoModal({ asesor, onClose }: Props) {
  const storeId = useStoreId();
  const mes = mesActual();
  const parentId = `${mes}_${asesor.id}`;
  const parentRef = doc(db, 'tiendas', storeId, 'ventasMes', parentId);

  const [tab, setTab] = useState<'diario' | 'acumulado'>('diario');
  // Mismo diseño que el recuadro del día: vista principal para agregar y el historial detrás del ícono de reloj.
  const [vista, setVista] = useState<'agregar' | 'historial'>('agregar');
  const [guardado, setGuardado] = useState(false);
  const claveVisto = `historial-mes-visto:${storeId}:${asesor.id}:${mes}`;
  const [vistoHasta, setVistoHasta] = useState<string>(() => {
    try { return localStorage.getItem(claveVisto) ?? ''; } catch { return ''; }
  });
  const [loading, setLoading] = useState(true);

  // Acumulado state
  const [entradas, setEntradas] = useState<Entrada[]>([]);
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

  // Registros diarios state
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [editRegKey, setEditRegKey] = useState<string | null>(null);
  const [editRegMonto, setEditRegMonto] = useState('');
  const [editRegUds, setEditRegUds] = useState('');
  const [editRegTxn, setEditRegTxn] = useState('');

  useEffect(() => {
    return onSnapshot(parentRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEntradas((data.acumulados ?? []).slice().reverse());
        setRegistros((data.registros ?? []).slice().reverse());
      } else {
        setEntradas([]);
        setRegistros([]);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, parentId]);

  // Group registros by date (most recent date first)
  const registrosPorFecha = registros.reduce<Record<string, Registro[]>>((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = [];
    acc[r.fecha].push(r);
    return acc;
  }, {});
  const fechas = Object.keys(registrosPorFecha).sort((a, b) => b.localeCompare(a));

  const totalDiario = registros.reduce(
    (acc, r) => ({ monto: acc.monto + r.monto, txn: acc.txn + r.transacciones, uds: acc.uds + r.unidades }),
    { monto: 0, txn: 0, uds: 0 }
  );

  // Registros diarios: edit / delete
  const handleEliminarReg = async (reg: Registro) => {
    try {
      const snap = await getDoc(parentRef);
      if (!snap.exists()) return;
      const todos: Registro[] = snap.data().registros ?? [];
      const filtered = todos.filter((r) => regKey(r) !== regKey(reg));
      await updateDoc(parentRef, {
        registros: filtered,
        totalVentas: increment(-reg.monto),
        totalUnidades: increment(-reg.unidades),
        totalTransacciones: increment(-reg.transacciones),
      });
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Eliminó venta de ${formatCurrency(reg.monto)} (${reg.transacciones} txn · ${reg.unidades} uds)`);
    } catch { /* silent */ }
  };

  const startEditReg = (r: Registro) => {
    setEditRegKey(regKey(r));
    setEditRegMonto(String(r.monto));
    setEditRegUds(String(r.unidades));
    setEditRegTxn(String(r.transacciones));
  };

  const handleGuardarEditReg = async (reg: Registro) => {
    const m = parseFloat(editRegMonto) || 0;
    const u = parseInt(editRegUds) || 0;
    const t = parseInt(editRegTxn) || 0;
    try {
      const snap = await getDoc(parentRef);
      if (!snap.exists()) return;
      const todos: Registro[] = snap.data().registros ?? [];
      const idx = todos.findIndex((r) => regKey(r) === regKey(reg));
      if (idx === -1) return;
      const updated = [...todos];
      updated[idx] = { ...reg, monto: m, unidades: u, transacciones: t };
      await updateDoc(parentRef, {
        registros: updated,
        totalVentas: increment(m - reg.monto),
        totalUnidades: increment(u - reg.unidades),
        totalTransacciones: increment(t - reg.transacciones),
      });
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Editó venta: ${formatCurrency(reg.monto)} → ${formatCurrency(m)} · ${t} txn · ${u} uds`);
      setEditRegKey(null);
    } catch { /* silent */ }
  };

  // Acumulado: add / edit / delete
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
      setGuardado(true);
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

  const totalAcumulado = entradas.reduce(
    (acc, e) => ({ monto: acc.monto + e.monto, transacciones: acc.transacciones + e.transacciones, unidades: acc.unidades + e.unidades }),
    { monto: 0, transacciones: 0, unidades: 0 }
  );

  const creados = [...registros.map((r) => r.creadoEn ?? ''), ...entradas.map((e) => e.creadoEn ?? '')];
  const nuevas = creados.filter((c) => c > vistoHasta).length;
  const marcarVisto = () => {
    const ultimo = creados.reduce((m, c) => (c > m ? c : m), vistoHasta);
    if (ultimo === vistoHasta) return;
    setVistoHasta(ultimo);
    try { localStorage.setItem(claveVisto, ultimo); } catch { /* sin almacenamiento local */ }
  };
  const cambiarVista = (v: 'agregar' | 'historial') => {
    marcarVisto();
    setVista(v);
    setEditId(null);
    setEditRegKey(null);
  };
  const cerrar = () => {
    if (vista === 'historial') marcarVisto();
    onClose();
  };
  const mesNombre = (() => {
    const [y, m] = mes.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  })();

  const EditIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );

  const TrashIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="theme-modal bg-surface rounded-2xl w-full max-w-sm flex flex-col max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh] animate-modal">

        {/* Header (igual al recuadro del día) */}
        <div className="flex items-start justify-between p-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {asesor.fotoBase64 ? (
                <Image src={asesor.fotoBase64} alt={asesor.nombre} width={40} height={40} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-gray-400">{asesor.nombre[0]}{asesor.apellido?.[0]}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-900 truncate">{asesor.nombre} {asesor.apellido}</p>
              <p className="text-xs text-gray-400">{vista === 'historial' ? 'Historial del mes' : 'Acumulado del mes'} · {mesNombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 -mr-1">
            <button
              type="button"
              onClick={() => cambiarVista(vista === 'historial' ? 'agregar' : 'historial')}
              aria-label={vista === 'historial'
                ? 'Volver a agregar al acumulado'
                : nuevas > 0 ? `Ver historial del mes (${nuevas} ${nuevas === 1 ? 'nueva' : 'nuevas'})` : 'Ver historial del mes'}
              aria-pressed={vista === 'historial'}
              title="Historial del mes"
              className={`relative p-2 rounded-lg transition-colors ${vista === 'historial' ? 'bg-gold-light text-gold-text' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l3 2" />
              </svg>
              {nuevas > 0 && vista !== 'historial' && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-gold text-[#00203D] text-[10px] font-bold leading-[1.05rem] text-center tabular-nums" aria-hidden="true">
                  {nuevas}
                </span>
              )}
            </button>
            <button onClick={cerrar} aria-label="Cerrar" className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {vista === 'agregar' ? (
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-6 pb-6 space-y-3">
            {showForm ? (
              <div className="border border-gray-100 rounded-xl p-3 space-y-3">
                <p className="text-xs font-medium text-gray-600">Nuevo acumulado</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Monto vendido</label>
                  <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-accent text-gray-900"
                    placeholder="Ej. 2500000" min={0} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Unidades</label>
                    <input type="number" value={uds} onChange={(e) => setUds(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-accent text-gray-900"
                      placeholder="Ej. 5" min={0} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Transacciones</label>
                    <input type="number" value={txn} onChange={(e) => setTxn(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-accent text-gray-900"
                      placeholder="Ej. 2" min={0} />
                  </div>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowForm(false); setError(''); }}
                    className="flex-1 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button onClick={handleAgregar} disabled={saving}
                    className="flex-1 px-3 py-2 text-sm font-medium text-on-accent bg-accent rounded-xl hover:bg-accent-hover disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {guardado && (
                  <div role="status" className="animate-slide-up flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[12.5px] leading-snug text-emerald-950">
                    <span aria-hidden="true" className="text-base leading-none">✅</span>
                    <p className="min-w-0"><span className="font-semibold text-emerald-700">Acumulado guardado.</span> Ya suma al total del mes.</p>
                  </div>
                )}
                <button onClick={() => { setShowForm(true); setGuardado(false); }}
                  className="w-full px-4 py-2.5 text-sm font-medium text-on-accent bg-accent rounded-xl hover:bg-accent-hover transition-colors">
                  + Agregar al acumulado
                </button>
                <p className="text-[12px] text-gray-400 text-center [text-wrap:pretty]">
                  Ventas del mes que no se registraron día a día. Para corregir ventas anteriores, abre el historial.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
        {/* Tabs */}
        <div className="flex mx-6 mb-3 bg-gray-100 rounded-xl p-1 gap-1 shrink-0">
          <button
            onClick={() => setTab('diario')}
            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${tab === 'diario' ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Ventas diarias
          </button>
          <button
            onClick={() => setTab('acumulado')}
            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${tab === 'acumulado' ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Acumulado del mes
          </button>
        </div>

        {/* Total strip */}
        {!loading && tab === 'diario' && registros.length > 0 && (
          <div className="mx-6 mb-3 bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between shrink-0">
            <span className="text-xs text-gray-500">Total registrado</span>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
              <span>{formatCurrency(totalDiario.monto)}</span>
              {totalDiario.txn > 0 && <span className="text-gray-500 font-normal">· {totalDiario.txn} txn</span>}
              {totalDiario.uds > 0 && <span className="text-gray-500 font-normal">· {totalDiario.uds} uds</span>}
            </div>
          </div>
        )}
        {!loading && tab === 'acumulado' && entradas.length > 0 && (
          <div className="mx-6 mb-3 bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between shrink-0">
            <span className="text-xs text-gray-500">Total acumulado</span>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
              {totalAcumulado.monto > 0 && <span>{formatCurrency(totalAcumulado.monto)}</span>}
              {totalAcumulado.transacciones > 0 && <span className="text-gray-500 font-normal">· {totalAcumulado.transacciones} txn</span>}
              {totalAcumulado.unidades > 0 && <span className="text-gray-500 font-normal">· {totalAcumulado.unidades} uds</span>}
            </div>
          </div>
        )}

        {/* List area */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-3 space-y-2 min-h-0">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : tab === 'diario' ? (
            fechas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin ventas registradas este mes.</p>
            ) : (
              <div className="space-y-4 pb-2">
                {fechas.map((fecha) => (
                  <div key={fecha}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{fecha}</p>
                    <div className="space-y-2">
                      {registrosPorFecha[fecha].map((r) => {
                        const key = regKey(r);
                        const isEditing = editRegKey === key;
                        return (
                          <div key={key} className="border border-gray-100 rounded-xl px-3 py-3">
                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                  {([
                                    { label: 'Monto', val: editRegMonto, set: setEditRegMonto },
                                    { label: 'Uds', val: editRegUds, set: setEditRegUds },
                                    { label: 'Txn', val: editRegTxn, set: setEditRegTxn },
                                  ] as const).map(({ label, val, set }) => (
                                    <div key={label}>
                                      <label className="block text-[10px] text-gray-400 mb-0.5">{label}</label>
                                      <input
                                        type="number"
                                        value={val}
                                        onChange={(e) => (set as (v: string) => void)(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-accent text-gray-900"
                                        min={1}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => setEditRegKey(null)}
                                    className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">
                                    Cancelar
                                  </button>
                                  <button onClick={() => handleGuardarEditReg(r)}
                                    className="flex-1 text-xs text-on-accent bg-accent rounded-lg py-1.5 hover:bg-accent-hover">
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
                                  <button onClick={() => startEditReg(r)}
                                    aria-label="Editar" className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-50 transition-colors">
                                    <EditIcon />
                                  </button>
                                  <button onClick={() => handleEliminarReg(r)}
                                    aria-label="Eliminar" className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-500/10 transition-colors">
                                    <TrashIcon />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            entradas.length === 0 && !showForm ? (
              <p className="text-sm text-gray-400 text-center py-6">No hay entradas aún.</p>
            ) : (
              entradas.map((entrada) => (
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
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-accent text-gray-900" min={0} />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditId(null)}
                          className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">
                          Cancelar
                        </button>
                        <button onClick={() => handleGuardarEdit(entrada)}
                          className="flex-1 text-xs text-on-accent bg-accent rounded-lg py-1.5 hover:bg-accent-hover">
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
                          aria-label="Editar" className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-50 transition-colors">
                          <EditIcon />
                        </button>
                        <button onClick={() => handleEliminar(entrada)}
                          aria-label="Eliminar" className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-500/10 transition-colors">
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>

        <div className="px-6 pb-6 pt-3 shrink-0 border-t border-gray-100">
          <button onClick={() => { cambiarVista('agregar'); setShowForm(true); setGuardado(false); }}
            className="w-full px-4 py-2.5 text-sm font-medium text-on-accent bg-accent rounded-xl hover:bg-accent-hover transition-colors">
            + Agregar al acumulado
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
