'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { registraSinIva } from '@/lib/iva';

// true si las ventas del mes se guardan sin IVA (diciembre 2026 en adelante, o un mes que la líder convirtió).
export function useMesSinIva(storeId: string | undefined, mes: string): boolean {
  const [convertido, setConvertido] = useState(false);
  useEffect(() => {
    if (!storeId) return;
    return onSnapshot(doc(db, 'tiendas', storeId, 'metas', mes), (s) => setConvertido(s.data()?.ventasSinIva === true));
  }, [storeId, mes]);
  return registraSinIva(mes, { ventasSinIva: convertido });
}
