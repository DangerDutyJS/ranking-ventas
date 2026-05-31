'use client';

import { useState } from 'react';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { verifyWithSalt, legacyHash } from '@/lib/hash';
import { useStoreId } from '@/context/StoreContext';

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 60_000;
const STORAGE_KEY = 'pin-intentos';

interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

function getAttempts(asesorId: string): AttemptRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[asesorId] ?? { count: 0, lockedUntil: 0 };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function saveAttempts(asesorId: string, record: AttemptRecord) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[asesorId] = record;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* noop */ }
}

function resetAttempts(asesorId: string) {
  saveAttempts(asesorId, { count: 0, lockedUntil: 0 });
}

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

  const attempts = getAttempts(asesor.id);
  const bloqueado = Date.now() < attempts.lockedUntil;
  const intentosRestantes = MAX_INTENTOS - attempts.count;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bloqueado) return;
    setError('');
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'tiendas', storeId, 'asesores', asesor.id));
      const data = snap.data() as { pinHash?: string; pinSalt?: string } | undefined;
      if (!data?.pinHash) {
        setError('Este asesor no tiene PIN asignado. Contacta al líder.');
        setLoading(false);
        return;
      }

      let ok = false;
      if (data.pinSalt) {
        ok = await verifyWithSalt(pin, data.pinHash, data.pinSalt);
      } else {
        ok = (await legacyHash(pin)) === data.pinHash;
      }

      if (ok) {
        resetAttempts(asesor.id);
        onSuccess();
      } else {
        const newCount = attempts.count + 1;
        const lockedUntil = newCount >= MAX_INTENTOS ? Date.now() + BLOQUEO_MS : 0;
        saveAttempts(asesor.id, { count: newCount, lockedUntil });
        if (newCount >= MAX_INTENTOS) {
          setError(`Demasiados intentos. Bloqueado por 1 minuto.`);
        } else {
          setError(`PIN incorrecto. ${MAX_INTENTOS - newCount} intento${MAX_INTENTOS - newCount === 1 ? '' : 's'} restante${MAX_INTENTOS - newCount === 1 ? '' : 's'}.`);
        }
        setPin('');
        setLoading(false);
      }
    } catch {
      setError('Error al verificar. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="w-full max-w-xs mx-4 bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.06)] border border-[#eaeaea] p-7 animate-modal">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#f2f2f2] overflow-hidden flex items-center justify-center mb-3">
            {asesor.fotoBase64 ? (
              <Image src={asesor.fotoBase64} alt={asesor.nombre} width={64} height={64} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-gray-400">
                {asesor.nombre[0]}{asesor.apellido[0]}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900">{asesor.nombre} {asesor.apellido}</p>
          <p className="text-[12px] text-[#8f8f8f] mt-0.5">Ingresa tu PIN</p>
        </div>

        {bloqueado ? (
          <div className="text-center space-y-4">
            <p className="text-[12px] text-red-500">Demasiados intentos fallidos. Espera 1 minuto antes de intentar de nuevo.</p>
            <button onClick={onClose}
              className="w-full h-9 px-4 text-[13px] text-[#8f8f8f] border border-[#eaeaea] rounded-md hover:bg-[#fafafa] transition-colors">
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <input
              type="password"
              autoComplete="off"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full px-3 py-3 text-center text-lg tracking-[0.5em] border border-[#eaeaea] rounded-md outline-none focus:border-black focus:ring-1 focus:ring-black/10 transition-colors text-gray-900"
              placeholder="••••"
              autoFocus
            />

            {error && <p className="text-[12px] text-red-500 text-center">{error}</p>}
            {!error && intentosRestantes < MAX_INTENTOS && (
              <p className="text-[12px] text-orange-500 text-center">{intentosRestantes} intento{intentosRestantes === 1 ? '' : 's'} restante{intentosRestantes === 1 ? '' : 's'}</p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 h-9 px-4 text-[13px] text-[#8f8f8f] border border-[#eaeaea] rounded-md hover:bg-[#fafafa] transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading || pin.length < 4}
                className="flex-1 h-9 px-4 text-[13px] font-medium text-white bg-black rounded-md hover:bg-gray-800 transition-colors disabled:opacity-40">
                {loading ? '...' : 'Entrar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
