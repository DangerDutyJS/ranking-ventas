'use client';

import { useState } from 'react';
import Image from 'next/image';
import { doc, setDoc, updateDoc, getDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  fotoBase64: string;
}

interface Props {
  asesor: Asesor;
  metaMensual: number;
  metaDiaria: number;
  totalVentas: number;
  onClose: () => void;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function VentasModal({ asesor, metaMensual, metaDiaria, totalVentas, onClose }: Props) {
  const storeId = useStoreId();
  const [monto, setMonto] = useState('');
  const [unidades, setUnidades] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);

  const falta = Math.max(0, metaMensual - totalVentas);
  const progreso = metaMensual > 0 ? Math.min(100, (totalVentas / metaMensual) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = Number(monto.replace(/\D/g, ''));
    const uds = Number(unidades);
    if (!valor || valor <= 0) return setError('Ingresa un monto válido.');
    if (!uds || uds <= 0 || !Number.isInteger(uds)) return setError('Ingresa las unidades vendidas (entero).');
    setLoading(true);
    setError('');
    const mes = mesActual();
    const docId = `${mes}_${asesor.id}`;
    const ref = doc(db, 'tiendas', storeId, 'ventasMes', docId);
    const registro = { monto: valor, unidades: uds, fecha: fechaHoy(), creadoEn: new Date().toISOString() };
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, {
          totalVentas: increment(valor),
          totalUnidades: increment(uds),
          totalTransacciones: increment(1),
          registros: arrayUnion(registro),
        });
      } else {
        await setDoc(ref, {
          mes,
          asesorId: asesor.id,
          totalVentas: valor,
          totalUnidades: uds,
          totalTransacciones: 1,
          registros: [registro],
        });
      }
      setGuardado(true);
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
      setLoading(false);
    }
  };

  if (guardado) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="w-full max-w-xs mx-4 bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900">¡Venta registrada!</p>
          <p className="text-xs text-gray-400 mt-1 mb-6">Se guardó correctamente.</p>
          <button onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-white rounded-2xl shadow-lg border border-gray-100 p-7">

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {asesor.fotoBase64 ? (
              <Image src={asesor.fotoBase64} alt={asesor.nombre} width={40} height={40} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-gray-400">{asesor.nombre[0]}{asesor.apellido[0]}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{asesor.nombre} {asesor.apellido}</p>
            <p className="text-xs text-gray-400">{fechaHoy()}</p>
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progreso mensual</span>
            <span className="font-medium text-gray-900">{progreso.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-gray-900 h-2 rounded-full transition-all" style={{ width: `${progreso}%` }} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Vendido: <span className="font-medium text-gray-700">{formatCurrency(totalVentas)}</span></span>
            <span className="text-gray-400">Falta: <span className="font-medium text-gray-700">{formatCurrency(falta)}</span></span>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2 flex justify-between text-xs">
            <span className="text-gray-500">Meta diaria</span>
            <span className="font-semibold text-gray-900">{formatCurrency(metaDiaria)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto vendido hoy</label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
              placeholder="Ej. 2500000"
              min={1}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unidades vendidas</label>
            <input
              type="number"
              value={unidades}
              onChange={(e) => setUnidades(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
              placeholder="Ej. 12"
              min={1}
              step={1}
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
              {loading ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
