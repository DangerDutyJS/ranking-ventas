'use client';

import { useEffect, useState } from 'react';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, limit, serverTimestamp,
} from 'firebase/firestore';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  fotoBase64: string;
}

interface Aplauso {
  id: string;
  asesorId: string;
  mensaje: string;
  fecha: string;
}

const SUGERENCIAS = [
  '¡Excelente atención al cliente hoy!',
  'Gracias por tu constancia, se nota en tus resultados.',
  'Gran venta: así se hace.',
  'Tu actitud levanta a todo el equipo.',
  '¡Qué buen cierre! Sigue así.',
];

const MAX = 120;

function fechaHoy() {
  return new Date().toLocaleDateString('fr-CA');
}

export default function ReconocimientosTab() {
  const storeId = useStoreId();
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [aplausos, setAplausos] = useState<Aplauso[]>([]);
  const [asesorId, setAsesorId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [saving, setSaving] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'tiendas', storeId, 'asesores'), orderBy('creadoEn', 'asc'));
    return onSnapshot(q, (snap) => setAsesores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asesor))));
  }, [storeId]);

  useEffect(() => {
    const q = query(collection(db, 'tiendas', storeId, 'aplausos'), orderBy('creadoEn', 'desc'), limit(20));
    return onSnapshot(q, (snap) => setAplausos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Aplauso))));
  }, [storeId]);

  async function enviar() {
    const texto = mensaje.trim();
    if (!asesorId || !texto) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'tiendas', storeId, 'aplausos'), {
        asesorId,
        mensaje: texto.slice(0, MAX),
        fecha: fechaHoy(),
        creadoEn: serverTimestamp(),
      });
      setMensaje('');
      setAsesorId('');
      setEnviado(true);
      setTimeout(() => setEnviado(false), 3000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  async function eliminar(id: string) {
    await deleteDoc(doc(db, 'tiendas', storeId, 'aplausos', id));
    setConfirmDelete(null);
  }

  const nombreDe = (id: string) => {
    const a = asesores.find((x) => x.id === id);
    return a ? `${a.nombre} ${a.apellido}` : 'Asesor eliminado';
  };

  return (
    <div className="space-y-6">
      <div className="theme-panel bg-surface border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-semibold text-heading mb-1">Enviar un aplauso 👏</h3>
        <p className="text-[13px] text-gray-400 mb-5">Aparece en el dashboard durante 7 días, con una celebración en vivo.</p>

        <p className="text-sm text-gray-500 mb-2">¿A quién?</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {asesores.map((a) => {
            const activo = asesorId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAsesorId(a.id)}
                aria-pressed={activo}
                className={`inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-[13px] transition-colors ${
                  activo ? 'border-accent bg-gold-light text-accent-text' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                  {a.fotoBase64
                    ? <Image src={a.fotoBase64} alt="" width={24} height={24} className="w-full h-full object-cover" />
                    : <span className="text-[10px] font-semibold text-gray-400">{a.nombre[0]}</span>}
                </span>
                {a.nombre}
              </button>
            );
          })}
        </div>

        <label htmlFor="aplauso-msg" className="block text-sm text-gray-500 mb-1.5">Mensaje</label>
        <textarea
          id="aplauso-msg"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value.slice(0, MAX))}
          rows={2}
          autoComplete="off"
          placeholder="Escribe un reconocimiento o elige una sugerencia"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
        />
        <div className="flex items-center justify-between mt-1 mb-3">
          <span className="text-xs text-gray-400 tabular-nums">{mensaje.length}/{MAX}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {SUGERENCIAS.map((s) => (
            <button key={s} type="button" onClick={() => setMensaje(s)}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors">
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={enviar}
          disabled={saving || !asesorId || !mensaje.trim()}
          className="w-full px-4 py-3 bg-accent text-on-accent rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-accent-hover transition-colors"
        >
          {saving ? 'Enviando...' : 'Enviar aplauso'}
        </button>
        {enviado && <p role="status" className="mt-3 text-[13px] text-emerald-700 text-center">¡Aplauso enviado! Ya se ve en el dashboard.</p>}
      </div>

      <section>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Recientes</p>
        {aplausos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Aún no has enviado reconocimientos.</p>
        ) : (
          <ul className="space-y-2">
            {aplausos.map((ap) => (
              <li key={ap.id} className="flex items-start gap-3 border border-gray-100 bg-surface rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700"><b className="text-heading">{nombreDe(ap.asesorId)}</b> · {ap.mensaje}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{ap.fecha}</p>
                </div>
                {confirmDelete === ap.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-gray-500">¿Eliminar?</span>
                    <button onClick={() => eliminar(ap.id)} className="text-xs font-medium text-red-600 px-2 py-1 rounded-md hover:bg-red-500/10">Sí</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 px-2 py-1 rounded-md hover:bg-gray-100">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(ap.id)} aria-label="Eliminar reconocimiento"
                    className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
