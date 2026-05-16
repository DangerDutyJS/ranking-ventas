'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AsignarPinModal from './AsignarPinModal';
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

  useEffect(() => {
    if (!storeId) return;
    const q = query(collection(db, 'tiendas', storeId, 'asesores'), orderBy('creadoEn', 'asc'));
    return onSnapshot(q, (snap) => {
      setAsesores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asesor)));
      setLoading(false);
    });
  }, []);

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
          <div key={asesor.id} className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between gap-3">
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
            <button
              onClick={() => setPinTarget(asesor)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                asesor.pinHash
                  ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                  : 'border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {asesor.pinHash ? 'PIN ✓' : 'Asignar PIN'}
            </button>
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
    </>
  );
}
