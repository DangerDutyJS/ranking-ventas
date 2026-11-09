// IVA por mes. Hasta noviembre 2026 la tienda registró las ventas CON IVA y la comisión se calcula quitándolo al
// final (venta ÷ 1,19). Desde diciembre 2026 el asesor escribe el valor de la factura (con IVA) y la app guarda la
// venta YA SIN IVA, con el IVA que la líder configura en la meta de cada mes: todo lo que se ve es lo que se paga.
// Solo importa tipos (así las pruebas de node lo cargan sin alias): misma fórmula que sinIva() de reglas.ts.
import type { ConfigRanking } from '@/lib/reglas';

export const MES_INICIO_SIN_IVA = '2026-12';

export function registraSinIva(mes: string): boolean {
  return mes >= MES_INICIO_SIN_IVA;
}

function ivaValido(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 50 ? v : null;
}

// % de IVA del mes: el de su meta (Meta del mes) o, si no lo tiene, el general de la tienda (19 por defecto).
export function ivaDelMes(meta: { ivaVentas?: number } | null | undefined, cfg: Pick<ConfigRanking, 'ivaVentas'>): number {
  return ivaValido(meta?.ivaVentas) ?? cfg.ivaVentas;
}

// IVA que se descuenta AL REGISTRAR (0 en meses viejos: esas ventas se guardan con IVA).
export function ivaAlRegistrar(mes: string, meta: { ivaVentas?: number } | null | undefined, cfg: Pick<ConfigRanking, 'ivaVentas'>): number {
  return registraSinIva(mes) ? ivaDelMes(meta, cfg) : 0;
}

// IVA que se descuenta AL PAGAR la comisión / en el reporte. En meses nuevos ya viene descontado: 0 (nunca dos veces).
export function ivaAlPagar(mes: string, meta: { ivaVentas?: number } | null | undefined, cfg: Pick<ConfigRanking, 'ivaVentas'>): number {
  return registraSinIva(mes) ? 0 : ivaDelMes(meta, cfg);
}

// Valor de factura (con IVA) → valor que se guarda. Se redondea a centavos para no acumular decimales infinitos.
export function montoARegistrar(factura: number, ivaPct: number): number {
  return ivaPct > 0 ? Math.round((factura / (1 + ivaPct / 100)) * 100) / 100 : factura;
}

// Valor guardado (sin IVA) → valor de factura, para precargar el formulario al editar.
export function montoFactura(guardado: number, ivaPct: number): number {
  return ivaPct > 0 ? Math.round(guardado * (1 + ivaPct / 100)) : guardado;
}
