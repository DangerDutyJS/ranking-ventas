'use client';

import { useEffect, useState } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  cargo: string;
}

interface Dinamica {
  id: string;
  nombre: string;
  meta: number;
  fecha: string;
  activa: boolean;
  asesoresIds: string[];
  progreso: Record<string, number>;
}

function fechaHoy() {
  return new Date().toLocaleDateString('fr-CA');
}

export default function DinamicasTab() {
  const storeId = useStoreId();
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [dinamicas, setDinamicas] = useState<Dinamica[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [meta, setMeta] = useState('');
  const [fecha, setFecha] = useState(fechaHoy());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'tiendas', storeId, 'asesores'), orderBy('creadoEn', 'asc'));
    return onSnapshot(q, (snap) => {
      setAsesores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asesor)));
    });
  }, [storeId]);

  useEffect(() => {
    const q = query(collection(db, 'tiendas', storeId, 'dinamicas'), orderBy('creadoEn', 'desc'));
    return onSnapshot(q, (snap) => {
      setDinamicas(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Dinamica)));
    });
  }, [storeId]);

  function toggleAsesor(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  }

  function resetForm() {
    setNombre(''); setMeta(''); setFecha(fechaHoy()); setSelectedIds([]); setShowForm(false);
  }

  async function handleCreate() {
    if (!nombre.trim() || !meta || selectedIds.length === 0) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'tiendas', storeId, 'dinamicas'), {
        nombre: nombre.trim(),
        meta: Number(meta),
        fecha,
        activa: true,
        asesoresIds: selectedIds,
        progreso: {},
        creadoEn: serverTimestamp(),
      });
      resetForm();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActiva(d: Dinamica) {
    await updateDoc(doc(db, 'tiendas', storeId, 'dinamicas', d.id), { activa: !d.activa });
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar esta dinámica?')) return;
    await deleteDoc(doc(db, 'tiendas', storeId, 'dinamicas', id));
  }

  const hoy = fechaHoy();
  const dinamicasHoy = dinamicas.filter((d) => d.fecha === hoy);
  const dinamicasPasadas = dinamicas.filter((d) => d.fecha !== hoy);

  return (
    <div>
      {!showForm && (
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva dinámica
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-5">Nueva dinámica</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Nombre de la dinámica</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Camisetas Colombia"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">Meta por asesor</label>
                <input
                  type="number"
                  min="1"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                  placeholder="5"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-500">Asesores que participan</label>
                <button
                  type="button"
                  onClick={() => setSelectedIds(asesores.map((a) => a.id))}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Todos
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {asesores.map((a) => (
                  <label key={a.id} className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(a.id)}
                      onChange={() => toggleAsesor(a.id)}
                      className="w-4 h-4 rounded border-gray-300 accent-gray-900"
                    />
                    <span className="text-sm text-gray-700 flex-1">{a.nombre} {a.apellido}</span>
                    <span className="text-xs text-gray-400">{a.cargo}</span>
                  </label>
                ))}
              </div>
              {selectedIds.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">{selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={resetForm}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !nombre.trim() || !meta || selectedIds.length === 0}
                className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-gray-700 transition-colors"
              >
                {saving ? 'Guardando...' : 'Crear dinámica'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dinamicasHoy.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Hoy</p>
          <div className="space-y-3">
            {dinamicasHoy.map((d) => (
              <DinamicaCard
                key={d.id}
                dinamica={d}
                asesores={asesores}
                onToggle={() => toggleActiva(d)}
                onDelete={() => handleDelete(d.id)}
              />
            ))}
          </div>
        </section>
      )}

      {dinamicasPasadas.length > 0 && (
        <section>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Anteriores</p>
          <div className="space-y-3">
            {dinamicasPasadas.map((d) => (
              <DinamicaCard
                key={d.id}
                dinamica={d}
                asesores={asesores}
                onToggle={() => toggleActiva(d)}
                onDelete={() => handleDelete(d.id)}
              />
            ))}
          </div>
        </section>
      )}

      {dinamicas.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 text-center py-16">No hay dinámicas creadas aún.</p>
      )}
    </div>
  );
}

function DinamicaCard({ dinamica, asesores, onToggle, onDelete }: {
  dinamica: Dinamica;
  asesores: Asesor[];
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const participantes = asesores.filter((a) => dinamica.asesoresIds.includes(a.id));
  const totalVal  = participantes.reduce((s, a) => s + (dinamica.progreso?.[a.id] ?? 0), 0);
  const totalMeta = dinamica.meta * (participantes.length || 1);
  const pctGlobal = totalMeta > 0 ? (totalVal / totalMeta) * 100 : 0;

  const fillColor = pctGlobal >= 100
    ? 'bg-gradient-to-r from-emerald-400 to-green-500'
    : pctGlobal >= 80
    ? 'bg-gradient-to-r from-amber-400 to-yellow-400'
    : 'bg-gradient-to-r from-rose-400 to-red-400';
  const pctText = pctGlobal >= 100 ? 'text-emerald-600' : pctGlobal >= 80 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className={`border rounded-2xl overflow-hidden transition-opacity ${
      dinamica.activa ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
    }`}>
      <div className="px-4 py-4">
        <div className="flex items-start gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">{dinamica.nombre}</span>
              <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                dinamica.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {dinamica.activa ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Meta {dinamica.meta} c/u · {participantes.length} asesor{participantes.length !== 1 ? 'es' : ''} · {dinamica.fecha}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onToggle}
              title={dinamica.activa ? 'Desactivar' : 'Activar'}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {dinamica.activa ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
            <button
              onClick={onDelete}
              title="Eliminar"
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-1 mb-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Total {totalVal} / {totalMeta}</span>
            <span className={`font-semibold ${pctText}`}>{pctGlobal.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${fillColor}`}
              style={{ width: `${Math.min(100, pctGlobal)}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors mt-1"
        >
          {expanded ? 'Ocultar asesores' : 'Ver por asesor'}
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {participantes.map((a) => {
            const val = dinamica.progreso?.[a.id] ?? 0;
            const pct = dinamica.meta > 0 ? (val / dinamica.meta) * 100 : 0;
            const fill  = pct >= 100 ? 'bg-emerald-400' : pct >= 80 ? 'bg-amber-400' : 'bg-rose-400';
            const color = pct >= 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-rose-600';
            return (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="text-xs font-medium text-gray-700 truncate">{a.nombre} {a.apellido}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400 tabular-nums">{val} / {dinamica.meta}</span>
                    <span className={`text-xs font-semibold tabular-nums w-8 text-right ${color}`}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${fill}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
