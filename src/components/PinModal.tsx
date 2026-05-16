'use client';

import { useState } from 'react';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { hashPin } from '@/lib/hash';
import { useStoreId } from '@/context/StoreContext';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  fotoBase64: string;
  pinHash?: string;
}

interface Props {
  asesor: Asesor;
  onSuccess: () => void;
  onClose: () => void;
}

export default function PinModal({ asesor, onSuccess, onClose }: Props) {
  const storeId = useStoreId();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'tiendas', storeId, 'asesores', asesor.id));
      const pinHash = snap.data()?.pinHash;
      if (!pinHash) {
        setError('Este asesor no tiene PIN asignado. Contacta al líder.');
        setLoading(false);
        return;
      }
      const inputHash = await hashPin(pin);
      if (inputHash === pinHash) {
        onSuccess();
      } else {
        setError('PIN incorrecto.');
        setPin('');
        setLoading(false);
      }
    } catch {
      setError('Error al verificar. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-xs mx-4 bg-white rounded-2xl shadow-lg border border-gray-100 p-7">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center mb-3">
            {asesor.fotoBase64 ? (
              <Image src={asesor.fotoBase64} alt={asesor.nombre} width={64} height={64} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-gray-400">
                {asesor.nombre[0]}{asesor.apellido[0]}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900">{asesor.nombre} {asesor.apellido}</p>
          <p className="text-xs text-gray-400 mt-0.5">Ingresa tu PIN</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <input
            type="password"
            autoComplete="off"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full px-3 py-3 text-center text-lg tracking-[0.5em] border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
            placeholder="••••"
            autoFocus
          />

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading || pin.length < 4}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
              {loading ? '...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
