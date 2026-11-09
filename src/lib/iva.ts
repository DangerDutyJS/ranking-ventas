// IVA por mes. Hasta noviembre 2026 la tienda registró las ventas CON IVA y la comisión se calcula quitándolo al
// final (venta ÷ 1,19). Desde diciembre 2026 el asesor escribe el valor de la factura (con IVA) y la app guarda la
// venta YA SIN IVA, con el IVA que la líder configura en la meta de cada mes: todo lo que se ve es lo que se paga.
// Solo importa tipos (así las pruebas de node lo cargan sin alias): misma fórmula que sinIva() de reglas.ts.
import type { ConfigRanking } from '@/lib/reglas';

export const MES_INICIO_SIN_IVA = '2026-12';

type MetaIva = { ivaVentas?: number; ventasSinIva?: boolean } | null | undefined;

// Un mes viejo también queda "sin IVA" si la líder lo convirtió (metas/{mes}.ventasSinIva).
export function registraSinIva(mes: string, meta?: MetaIva): boolean {
  return mes >= MES_INICIO_SIN_IVA || meta?.ventasSinIva === true;
}

function ivaValido(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 50 ? v : null;
}

// % de IVA del mes: el de su meta (Meta del mes) o, si no lo tiene, el general de la tienda (19 por defecto).
export function ivaDelMes(meta: { ivaVentas?: number } | null | undefined, cfg: Pick<ConfigRanking, 'ivaVentas'>): number {
  return ivaValido(meta?.ivaVentas) ?? cfg.ivaVentas;
}

// IVA que se descuenta AL REGISTRAR (0 en meses viejos: esas ventas se guardan con IVA).
export function ivaAlRegistrar(mes: string, meta: MetaIva, cfg: Pick<ConfigRanking, 'ivaVentas'>): number {
  return registraSinIva(mes, meta) ? ivaDelMes(meta, cfg) : 0;
}

// IVA que se descuenta AL PAGAR la comisión / en el reporte. En meses nuevos ya viene descontado: 0 (nunca dos veces).
export function ivaAlPagar(mes: string, meta: MetaIva, cfg: Pick<ConfigRanking, 'ivaVentas'>): number {
  return registraSinIva(mes, meta) ? 0 : ivaDelMes(meta, cfg);
}

// Valor de factura (con IVA) → valor que se guarda. Se redondea a centavos para no acumular decimales infinitos.
export function montoARegistrar(factura: number, ivaPct: number): number {
  return ivaPct > 0 ? Math.round((factura / (1 + ivaPct / 100)) * 100) / 100 : factura;
}

// Valor guardado (sin IVA) → valor de factura, para precargar el formulario al editar.
export function montoFactura(guardado: number, ivaPct: number): number {
  return ivaPct > 0 ? Math.round(guardado * (1 + ivaPct / 100)) : guardado;
}

// ── Conversión única de un mes registrado con IVA (ej. noviembre 2026) a sin IVA ──
// Funciones puras: reciben el documento leído y devuelven solo los campos de dinero ya divididos por (1 + iva).
// Transacciones, unidades, UPT y % no cambian (el IVA se cancela en las razones).
const quitar = (v: unknown, iva: number) => (typeof v === 'number' ? montoARegistrar(v, iva) : v);

export interface DocVentasIva {
  totalVentas?: number;
  registros?: { monto: number }[];
  acumulados?: { monto: number }[];
  acumuladoMes?: { monto: number };
}

export function convertirVentasSinIva<T extends DocVentasIva>(d: T, iva: number): Partial<T> {
  const out: Partial<T> = {};
  if (typeof d.totalVentas === 'number') out.totalVentas = montoARegistrar(d.totalVentas, iva);
  if (Array.isArray(d.registros)) out.registros = d.registros.map((r) => ({ ...r, monto: montoARegistrar(r.monto ?? 0, iva) }));
  if (Array.isArray(d.acumulados)) out.acumulados = d.acumulados.map((r) => ({ ...r, monto: montoARegistrar(r.monto ?? 0, iva) }));
  if (d.acumuladoMes && typeof d.acumuladoMes.monto === 'number') out.acumuladoMes = { ...d.acumuladoMes, monto: montoARegistrar(d.acumuladoMes.monto, iva) };
  return out;
}

export interface DocMetaIva {
  montoTotal?: number;
  metaAVT?: number;
  metasPorDia?: Record<string, { monto?: number; avt?: number }>;
}

export function convertirMetaSinIva<T extends DocMetaIva>(m: T, iva: number): Partial<T> & { ventasSinIva: true; ivaVentas: number } {
  const out: Partial<T> & { ventasSinIva: true; ivaVentas: number } = { ventasSinIva: true, ivaVentas: iva } as Partial<T> & { ventasSinIva: true; ivaVentas: number };
  if (typeof m.montoTotal === 'number') out.montoTotal = montoARegistrar(m.montoTotal, iva);
  if (typeof m.metaAVT === 'number') out.metaAVT = montoARegistrar(m.metaAVT, iva);
  if (m.metasPorDia) {
    out.metasPorDia = Object.fromEntries(Object.entries(m.metasPorDia).map(([k, v]) => [k, {
      ...v,
      ...(typeof v.monto === 'number' && { monto: quitar(v.monto, iva) as number }),
      ...(typeof v.avt === 'number' && { avt: quitar(v.avt, iva) as number }),
    }])) as T['metasPorDia'];
  }
  return out;
}
