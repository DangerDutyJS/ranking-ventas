'use client';

import { useState } from 'react';
import { convertirMesSinIva, previsualizarConversion, type ResumenConversion } from '@/lib/convertirMesSinIva';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

// Paso único para un mes que se registró con IVA: le quita el IVA a ventas, acumulados y metas de una vez.
export default function ConvertirMesSinIvaPanel({ storeId, mes, mesNombre, montoMeta, iva, onConvertido }: {
  storeId: string;
  mes: string;
  mesNombre: string;
  montoMeta: number;
  iva: number;
  onConvertido: () => void;
}) {
  const [resumen, setResumen] = useState<ResumenConversion | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');

  const revisar = async () => {
    setError('');
    setTrabajando(true);
    try {
      setResumen(await previsualizarConversion(storeId, mes, montoMeta, iva));
    } catch {
      setError('No se pudo leer las ventas del mes. Intenta de nuevo.');
    } finally {
      setTrabajando(false);
    }
  };

  const confirmar = async () => {
    setError('');
    setTrabajando(true);
    try {
      await convertirMesSinIva(storeId, mes, iva);
      onConvertido();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo convertir. No se cambió nada.');
      setTrabajando(false);
    }
  };

  if (iva <= 0) return null;

  return (
    <section aria-label="Pasar el mes a sin IVA" className="rounded-xl border border-gold/50 bg-gold-light p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">Pasar {mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} a valores sin IVA</p>
        <p className="text-[12.5px] text-gray-600 mt-1 [text-wrap:pretty]">
          Este mes se registró con IVA. Al pasarlo, a todas las ventas, acumulados, la meta, la Meta AVT y los presupuestos
          diarios se les quita el {iva}% (÷ {(1 + iva / 100).toLocaleString('es-CO')}). Los asesores verán lo que realmente
          se les paga y las ventas nuevas se registran sin IVA. La comisión y el puesto de cada asesor no cambian.
        </p>
      </div>

      {!resumen ? (
        <button onClick={revisar} disabled={trabajando}
          className="w-full px-4 py-2.5 text-sm font-medium text-on-accent bg-accent rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors">
          {trabajando ? 'Revisando…' : 'Revisar el cambio'}
        </button>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
            <div className="rounded-lg bg-surface border border-gray-200 px-3 py-2">
              <dt className="text-gray-500">Ventas del mes ({resumen.asesores} asesores)</dt>
              <dd className="tabular-nums text-gray-500 line-through">{formatCurrency(resumen.ventaAntes)}</dd>
              <dd className="tabular-nums font-semibold text-gray-900">{formatCurrency(resumen.ventaDespues)}</dd>
            </div>
            <div className="rounded-lg bg-surface border border-gray-200 px-3 py-2">
              <dt className="text-gray-500">Meta del mes</dt>
              <dd className="tabular-nums text-gray-500 line-through">{formatCurrency(resumen.metaAntes)}</dd>
              <dd className="tabular-nums font-semibold text-gray-900">{formatCurrency(resumen.metaDespues)}</dd>
            </div>
          </dl>
          <p className="text-[12px] text-gray-600">Se hace una sola vez y no se puede repetir. ¿Pasar el mes a sin IVA?</p>
          <div className="flex gap-2">
            <button onClick={() => setResumen(null)} disabled={trabajando}
              className="flex-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 bg-surface rounded-xl hover:bg-gray-50 disabled:opacity-50">
              No
            </button>
            <button onClick={confirmar} disabled={trabajando}
              className="flex-1 px-3 py-2 text-sm font-medium text-on-accent bg-accent rounded-xl hover:bg-accent-hover disabled:opacity-50">
              {trabajando ? 'Convirtiendo…' : 'Sí, pasar a sin IVA'}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
