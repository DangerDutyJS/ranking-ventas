'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { collection, onSnapshot, orderBy, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AsignarPinModal from './AsignarPinModal';
import EditAsesorModal from './EditAsesorModal';
import { useStoreId } from '@/context/StoreContext';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  cargo: string;
  fotoBase64: string;
  pinHash?: string;
}

export default function AsesorList() {
  const storeId = useStoreId();
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinTarget, setPinTarget] = useState<Asesor | null>(null);
  const [editTarget, setEditTarget] = useState<Asesor | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
    const q = query(collection(db, 'tiendas', storeId, 'asesores'), orderBy('creadoEn', 'asc'));
    return onSnapshot(q, (snap) => {
      setAsesores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asesor)));
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'tiendas', storeId, 'asesores', id));
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
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
    return <p className="text-sm text-gray-400 py-12 text-center">Aún no hay asesores registrados.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {asesores.map((asesor) => (
          <div key={asesor.id} className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-3">

            {/* Info asesor */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {asesor.fotoBase64 ? (
                  <Image src={asesor.fotoBase64} alt={asesor.nombre} width={48} height={48} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-gray-400">{asesor.nombre[0]}{asesor.apellido[0]}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{asesor.nombre} {asesor.apellido}</p>
                <p className="text-xs text-gray-400 truncate">{asesor.cargo}</p>
              </div>
            </div>

            {/* Acciones */}
            {confirmDelete === asesor.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 flex-1">¿Eliminar asesor?</span>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  No
                </button>
                <button
                  onClick={() => handleDelete(asesor.id)}
                  disabled={deleting === asesor.id}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {deleting === asesor.id ? '...' : 'Sí, eliminar'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPinTarget(asesor)}
                  className={`flex-1 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    asesor.pinHash
                      ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                      : 'border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {asesor.pinHash ? 'PIN ✓' : 'Asignar PIN'}
                </button>

                {/* Editar */}
                <button
                  onClick={() => setEditTarget(asesor)}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  title="Editar asesor"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
                  </svg>
                </button>

                {/* Eliminar */}
                <button
                  onClick={() => setConfirmDelete(asesor.id)}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                  title="Eliminar asesor"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {pinTarget && (
        <AsignarPinModal
          asesorId={pinTarget.id}
          nombre={`${pinTarget.nombre} ${pinTarget.apellido}`}
          tienePin={!!pinTarget.pinHash}
          onClose={() => setPinTarget(null)}
        />
      )}

      {editTarget && (
        <EditAsesorModal
          asesor={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  );
}
