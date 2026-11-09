// Conversión ÚNICA de un mes guardado con IVA a sin IVA, hecha por la líder desde Meta del mes.
// Va en una transacción: si un asesor registra una venta en ese instante, Firestore reintenta con los datos nuevos
// (no se pierde ni se convierte dos veces). La meta queda marcada con ventasSinIva y no se puede repetir.
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { convertirMetaSinIva, convertirVentasSinIva, montoARegistrar, type DocMetaIva, type DocVentasIva } from '@/lib/iva';

export interface ResumenConversion {
  asesores: number;
  ventaAntes: number;
  ventaDespues: number;
  metaAntes: number;
  metaDespues: number;
}

const totalDoc = (d: DocVentasIva) => (d.totalVentas ?? 0) + (d.acumuladoMes?.monto ?? 0);

async function idsVentasDelMes(storeId: string, mes: string) {
  const snap = await getDocs(query(collection(db, 'tiendas', storeId, 'ventasMes'), where('mes', '==', mes)));
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as DocVentasIva }));
}

// Vista previa (solo lectura).
export async function previsualizarConversion(storeId: string, mes: string, montoMeta: number, iva: number): Promise<ResumenConversion> {
  const docs = await idsVentasDelMes(storeId, mes);
  const antes = docs.reduce((p, d) => p + totalDoc(d.data), 0);
  const despues = docs.reduce((p, d) => {
    const c = convertirVentasSinIva(d.data, iva);
    return p + (c.totalVentas ?? d.data.totalVentas ?? 0) + (c.acumuladoMes?.monto ?? d.data.acumuladoMes?.monto ?? 0);
  }, 0);
  return { asesores: docs.length, ventaAntes: antes, ventaDespues: despues, metaAntes: montoMeta, metaDespues: montoARegistrar(montoMeta, iva) };
}

export async function convertirMesSinIva(storeId: string, mes: string, iva: number): Promise<void> {
  const ids = (await idsVentasDelMes(storeId, mes)).map((d) => d.id);
  const metaRef = doc(db, 'tiendas', storeId, 'metas', mes);
  await runTransaction(db, async (tx) => {
    const metaSnap = await tx.get(metaRef);
    if (!metaSnap.exists()) throw new Error('El mes no tiene meta guardada.');
    const meta = metaSnap.data() as DocMetaIva & { ventasSinIva?: boolean };
    if (meta.ventasSinIva) throw new Error('Este mes ya está sin IVA.');
    const refs = ids.map((id) => doc(db, 'tiendas', storeId, 'ventasMes', id));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    snaps.forEach((s, i) => {
      if (s.exists()) tx.update(refs[i], convertirVentasSinIva(s.data() as DocVentasIva, iva) as Record<string, unknown>);
    });
    tx.update(metaRef, { ...convertirMetaSinIva(meta, iva), convertidoSinIvaEn: serverTimestamp() } as Record<string, unknown>);
  });
}
