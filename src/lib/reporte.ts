// Reporte mensual con el MISMO formato de la hoja de la empresa (columnas SAP … PAGO COMISIONES MENSUAL).
// Solo lee datos y reutiliza las reglas de reglas.ts: los números son los mismos que muestra el dashboard.
import { calcularMetas } from '@/lib/calcularMetas';
import {
  calcularScoreRanking, calcularComisionPorPuntaje, compararRanking, metasUptAvt, totalReal, sinIva,
  type ConfigRanking, type MetaIndicadores,
} from '@/lib/reglas';
import { ivaAlPagar, registraSinIva } from '@/lib/iva';

export interface AsesorReporte {
  id: string;
  nombre: string;
  apellido: string;
  cargo?: string;
  codigoSap?: string;
  horasTrabajo?: number;
}

export interface VentaReporte {
  asesorId: string;
  totalVentas?: number;
  totalUnidades?: number;
  totalTransacciones?: number;
  acumuladoMes?: { monto: number; unidades?: number; transacciones?: number };
}

export interface MetaReporte extends MetaIndicadores {
  asesores?: Record<string, { diasLaborados: number }>;
  ivaVentas?: number;
  ventasSinIva?: boolean;
}

export interface FilaReporte {
  sap: string;
  colaborador: string;
  posicion: string;
  horas: number | null;
  dias: number | null;
  metaUPT: number | null;
  realUPT: number | null;
  pctUPT: number | null;
  ptsUPT: number | null;
  metaAVT: number | null;
  realAVT: number | null;
  pctAVT: number | null;
  ptsAVT: number | null;
  metaVenta: number;
  realVenta: number;
  pctVenta: number | null;
  ptsVenta: number | null;
  cumplimiento: number | null;
  comision: number;
  tramo: 'amarillo' | 'verde' | 'azul' | 'celeste' | null;
}

export interface Reporte {
  mes: string;
  titulo: string;
  // IVA que se le quitó al armar el reporte (0 si las ventas del mes ya se registraron sin IVA).
  ivaVentas: number;
  sinIvaAlRegistrar: boolean;
  filas: FilaReporte[];
  totales: {
    horas: number;
    metaAVTPromedio: number | null;
    realAVTPromedio: number | null;
    metaVenta: number;
    realVenta: number;
    comision: number;
  };
}

export function nombreMesLargo(mes: string) {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

export function construirReporte(
  mes: string,
  asesores: AsesorReporte[],
  ventasDelMes: VentaReporte[],
  meta: MetaReporte | null | undefined,
  cfg: ConfigRanking,
): Reporte {
  const ids = asesores.map((a) => a.id);
  const metasMap = meta && ids.length > 0 ? calcularMetas(meta.montoTotal, ids, meta.asesores ?? {}) : {};
  const { upt: metaUPT, avt: metaAVT } = metasUptAvt(meta);
  // Meses viejos: registros con IVA, se quita aquí. Desde diciembre 2026 ya vienen sin IVA (iva = 0, nunca dos veces).
  const iva = ivaAlPagar(mes, meta, cfg);
  const ventaDe = new Map(ventasDelMes.map((v) => [v.asesorId, v]));

  const filas = asesores.map((a) => {
    const v = ventaDe.get(a.id);
    const realVenta = totalReal(v);
    const unidades = (v?.totalUnidades ?? 0) + (v?.acumuladoMes?.unidades ?? 0);
    const transacciones = (v?.totalTransacciones ?? 0) + (v?.acumuladoMes?.transacciones ?? 0);
    const metaVenta = metasMap[a.id]?.metaMensual ?? 0;
    const s = calcularScoreRanking({ ventaReal: realVenta, metaVenta, unidades, transacciones, metaUPT, metaAVT }, cfg);
    const c = calcularComisionPorPuntaje(metaVenta, realVenta, s.score, s.venta.peso, iva);
    // La empresa reporta en pesos SIN IVA; la tienda registra con IVA. Los % y puntos no cambian.
    const neto = (v: number | null) => (v === null ? null : sinIva(v, iva));
    const fila: FilaReporte = {
      sap: a.codigoSap ?? '',
      colaborador: `${a.nombre} ${a.apellido}`.trim().toUpperCase(),
      posicion: (a.cargo ?? '').toUpperCase(),
      horas: a.horasTrabajo ?? 48,
      dias: meta?.asesores?.[a.id]?.diasLaborados ?? null,
      metaUPT,
      realUPT: s.upt.real,
      pctUPT: s.upt.pct,
      ptsUPT: s.upt.peso > 0 ? s.upt.puntos : null,
      metaAVT: neto(metaAVT),
      realAVT: neto(s.avt.real),
      pctAVT: s.avt.pct,
      ptsAVT: s.avt.peso > 0 ? s.avt.puntos : null,
      metaVenta: sinIva(metaVenta, iva),
      realVenta: sinIva(realVenta, iva),
      pctVenta: s.pctVenta,
      ptsVenta: s.score !== null ? s.venta.puntos : null,
      cumplimiento: s.score,
      comision: c.pago,
      tramo: c.talento,
    };
    return { fila, orden: { score: s.score, ventaReal: realVenta } };
  });
  // Mismo orden que el ranking mensual.
  filas.sort((x, y) => compararRanking(x.orden, y.orden));

  const lista = filas.map((f) => f.fila);
  const promedio = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null && x > 0);
    return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null;
  };
  return {
    mes,
    titulo: `Ranking de ventas · ${nombreMesLargo(mes)}`,
    ivaVentas: iva,
    sinIvaAlRegistrar: registraSinIva(mes, meta),
    filas: lista,
    totales: {
      horas: lista.reduce((p, f) => p + (f.horas ?? 0), 0),
      metaAVTPromedio: promedio(lista.map((f) => f.metaAVT)),
      realAVTPromedio: promedio(lista.map((f) => f.realAVT)),
      metaVenta: lista.reduce((p, f) => p + f.metaVenta, 0),
      realVenta: lista.reduce((p, f) => p + f.realVenta, 0),
      comision: lista.reduce((p, f) => p + f.comision, 0),
    },
  };
}
