'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { hashPin } from '@/lib/hash';
import { useStoreId } from '@/context/StoreContext';

interface Props {
  asesorId: string;
  nombre: string;
  tienePin: boolean;
  onClose: () => void;
}

export default function AsignarPinModal({ asesorId, nombre, tienePin, onClose }: Props) {
  const storeId = useStoreId();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) return setError('El PIN debe ser de 4 dígitos.');
    if (pin !== confirm) return setError('Los PINs no coinciden.');
    setLoading(true);
    try {
      const pinHash = await hashPin(pin);
      await updateDoc(doc(db, 'tiendas', storeId, 'asesores', asesorId), { pinHash });
      onClose();
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-xs mx-4 bg-white rounded-2xl shadow-lg border border-gray-100 p-7">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          {tienePin ? 'Cambiar PIN' : 'Asignar PIN'}
        </h2>
        <p className="text-xs text-gray-400 mb-6">{nombre}</p>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">PIN (4 dígitos)</label>
            <input
              type="password"
              autoComplete="new-password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900 tracking-widest text-center"
              placeholder="••••"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar PIN</label>
            <input
              type="password"
              autoComplete="new-password"
              inputMode="numeric"
              maxLength={4}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900 tracking-widest text-center"
              placeholder="••••"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
