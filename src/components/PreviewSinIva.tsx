'use client';

import { montoARegistrar } from '@/lib/iva';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

// Muestra en vivo lo que realmente se guarda (y sobre lo que se paga la comisión) al escribir el valor de la factura.
export default function PreviewSinIva({ valor, iva, compacto = false }: { valor: string; iva: number; compacto?: boolean }) {
  if (iva <= 0) return null;
  const factura = Number(String(valor).replace(/[^\d.]/g, '')) || 0;
  if (compacto) {
    return (
      <p className="text-[10px] text-gray-500 mt-0.5 tabular-nums" aria-live="polite">
        {factura > 0 ? <>Sin IVA: <span className="font-semibold text-gray-700">{formatCurrency(montoARegistrar(factura, iva))}</span></> : `Se guarda sin IVA (${iva}%)`}
      </p>
    );
  }
  return (
    <p className="text-[11.5px] text-gray-500 mt-1 tabular-nums" aria-live="polite">
      {factura > 0 ? (
        <>Se registra sin IVA: <span className="font-semibold text-emerald-700">{formatCurrency(montoARegistrar(factura, iva))}</span> <span className="text-gray-400">(IVA {iva}%)</span></>
      ) : (
        <>Escribe el total de la factura; la app le quita el IVA ({iva}%).</>
      )}
    </p>
  );
}
