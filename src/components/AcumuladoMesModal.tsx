'use client';

import { useState } from 'react';
import { doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
}

interface Props {
  asesor: Asesor;
  acumuladoActual?: { monto: number; unidades: number; transacciones: number };
  onClose: () => void;
}

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function AcumuladoMesModal({ asesor, acumuladoActual, onClose }: Props) {
  const storeId = useStoreId();
  const [monto, setMonto] = useState(acumuladoActual?.monto ? String(acumuladoActual.monto) : '');
  const [transacciones, setTransacciones] = useState(acumuladoActual?.transacciones ? String(acumuladoActual.transacciones) : '');
  const [unidades, setUnidades] = useState(acumuladoActual?.unidades ? String(acumuladoActual.unidades) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleGuardar = async () => {
    const m = parseFloat(monto) || 0;
    const t = parseInt(transacciones) || 0;
    const u = parseInt(unidades) || 0;
    if (m <= 0 && t <= 0 && u <= 0) {
      setError('Ingresa al menos un valor.');
      return;
    }
    setSaving(true);
    const mes = mesActual();
    const docRef = doc(db, 'tiendas', storeId, 'ventasMes', `${mes}_${asesor.id}`);
    try {
      try {
        await updateDoc(docRef, {
          'acumuladoMes.monto': increment(m),
          'acumuladoMes.transacciones': increment(t),
          'acumuladoMes.unidades': increment(u),
        });
      } catch (e: unknown) {
        if ((e as { code?: string })?.code === 'not-found') {
          await setDoc(docRef, {
            mes,
            asesorId: asesor.id,
            acumuladoMes: { monto: m, transacciones: t, unidades: u },
          });
        } else {
          throw e;
        }
      }
      onClose();
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-5">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Acumulado del mes</p>
          <p className="text-base font-semibold text-gray-900">{asesor.nombre} {asesor.apellido}</p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            Ingresa ventas que no registraste por día. Se acumula al mes pero no afecta el ranking de hoy.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto acumulado</label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
              placeholder="Ej. 3500000"
              min={0}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Transacciones</label>
              <input
                type="number"
                value={transacciones}
                onChange={(e) => setTransacciones(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
                placeholder="Ej. 12"
                min={0}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unidades</label>
              <input
                type="number"
                value={unidades}
                onChange={(e) => setUnidades(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
                placeholder="Ej. 25"
                min={0}
              />
            </div>
          </div>
        </div>

        {acumuladoActual && (acumuladoActual.monto > 0 || acumuladoActual.transacciones > 0) && (
          <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
            Ya hay un acumulado: {acumuladoActual.monto > 0 && `$${acumuladoActual.monto.toLocaleString('es-CO')}`}{acumuladoActual.transacciones > 0 && ` · ${acumuladoActual.transacciones} txn`}{acumuladoActual.unidades > 0 && ` · ${acumuladoActual.unidades} uds`}. El nuevo valor se sumará al existente.
          </p>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
