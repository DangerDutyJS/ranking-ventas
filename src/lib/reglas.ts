// REGLAS DE NEGOCIO CONGELADAS — no modificar sin autorización explícita del usuario.
// Orden del ranking mensual, topes de comisión (90/100/110/120%) y colores de la barra de progreso.
// Excepción autorizada por el usuario (2026-11-08): en barColor el tramo <25% pasó de rojo a naranja
// "de arranque" (evitar el rojo de alarma). Orden de colores y umbrales intactos.
// Se movieron aquí desde page.tsx sin cambios para que el modo TV y la capa de motivación
// lean exactamente las mismas reglas. Lo nuevo (rachas, insignias, mensajes) vive en motivacion.ts
// y solo LEE de este archivo.

interface TotalesMes {
  totalVentas?: number;
  acumuladoMes?: { monto: number };
}

export function totalReal(vm: TotalesMes | undefined) {
  return (vm?.totalVentas ?? 0) + (vm?.acumuladoMes?.monto ?? 0);
}

export function barColor(p: number) {
  if (p >= 120) return 'bg-gradient-to-r from-sky-400 to-cyan-400';
  if (p >= 110) return 'bg-gradient-to-r from-blue-500 to-indigo-500';
  if (p >= 100) return 'bg-gradient-to-r from-emerald-400 to-green-500';
  if (p >= 75)  return 'bg-gradient-to-r from-teal-400 to-emerald-400';
  if (p >= 50)  return 'bg-gradient-to-r from-amber-400 to-yellow-400';
  if (p >= 25)  return 'bg-gradient-to-r from-orange-400 to-amber-400';
  return 'bg-gradient-to-r from-orange-500 to-orange-400';
}

export interface ComisionResult {
  pct: number;
  talento: 'amarillo' | 'verde' | 'azul' | 'celeste' | null;
  comision: number | null;
  falta90: number;
  falta100: number;
  falta110: number;
  falta120: number;
}

export function calcularComision(metaAsignada: number, montoVendido: number): ComisionResult {
  const pct = metaAsignada > 0 ? (montoVendido / metaAsignada) * 100 : 0;
  const meta90  = metaAsignada * 0.90;
  const meta100 = metaAsignada * 1.00;
  const meta110 = metaAsignada * 1.10;
  const meta120 = metaAsignada * 1.20;

  let talento: ComisionResult['talento'] = null;
  let comision: number | null = null;
  if (pct >= 120)       { talento = 'celeste';  comision = 1.30; }
  else if (pct >= 110)  { talento = 'azul';     comision = 1.20; }
  else if (pct >= 100)  { talento = 'verde';    comision = 1.10; }
  else if (pct >= 90)   { talento = 'amarillo'; comision = 0.65; }

  return {
    pct,
    talento,
    comision,
    falta90:  Math.max(0, meta90  - montoVendido),
    falta100: Math.max(0, meta100 - montoVendido),
    falta110: Math.max(0, meta110 - montoVendido),
    falta120: Math.max(0, meta120 - montoVendido),
  };
}

export const SIGUIENTE_NIVEL = [
  { pct: 90,  label: 'Amarilla', tasa: 0.65 },
  { pct: 100, label: 'Verde',    tasa: 1.10 },
  { pct: 110, label: 'Azul',     tasa: 1.20 },
  { pct: 120, label: 'Celeste',  tasa: 1.30 },
];

// ══ PUNTAJE PONDERADO DEL RANKING MENSUAL (agregado 2026-11-08, autorizado por el usuario) ══════════
// Reemplaza el orden por dinero del ranking MENSUAL (el ranking de hoy sigue con pctCombinadoHoy).
//   score = %Venta·0.80 + %UPT·0.10 + %AVT·0.10
// - ALINEADO CON LA HOJA DE LA EMPRESA (decisión del usuario 2026-11-08, verificado con datos reales):
//   por defecto SIN tope y SIN umbral (topeUPT/topeAVT = 0 y umbralRescate = 0): UPT/AVT cuentan completos.
//   Siguen disponibles como parámetros: tope > 0 limita el % que cuenta; umbral > 0 exige ese % de venta
//   para que UPT/AVT pasen de 100%.
// - Mínimo de transacciones: UPT/AVT no suman nada hasta que el asesor lleve minTxnIndicadores (10)
//   transacciones en el mes; una venta suelta no puede regalar 20 puntos de "calidad".
// - Piso de protección: si %Venta ≥ 100, UPT/AVT nunca cuentan menos de 100% (no le quitan el 100%
//   a quien ya trajo toda la plata).
// - Si la tienda no tiene meta de UPT/AVT, su peso pasa a la venta.
// - Comisión (como la hoja): el TRAMO sale del PUNTAJE total (90/100/110/120) y se paga sobre la VENTA
//   REAL SIN IVA (la tienda registra con IVA; la empresa paga sin IVA: venta ÷ (1 + iva)), calcularComisionPorPuntaje.
//   Antes se multiplicaba por 0,81, que NO quita bien el IVA (lo correcto es ÷ 1,19). Premios Pin/Bono corral/Día libre usan el mismo
//   cumplimiento total.

export interface ConfigRanking {
  pesoVenta: number;
  pesoUPT: number;
  pesoAVT: number;
  topeUPT: number;
  topeAVT: number;
  umbralRescate: number;
  minTxnIndicadores: number;
  // % de IVA incluido en las ventas registradas (19 en Colombia). 0 = las ventas se registran sin IVA.
  ivaVentas: number;
}

export const CONFIG_RANKING_DEFAULT: ConfigRanking = {
  pesoVenta: 0.8,
  pesoUPT: 0.1,
  pesoAVT: 0.1,
  topeUPT: 0,
  topeAVT: 0,
  umbralRescate: 0,
  minTxnIndicadores: 10,
  ivaVentas: 19,
};

function numeroValido(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

// Tope: 0 = sin tope; si no, entre 100% y 1000%.
function topeValido(v: unknown): number | null {
  return v === 0 ? 0 : numeroValido(v, 100, 1000);
}

// Valida lo leído de Firestore; cualquier valor ausente o fuera de rango cae al valor por defecto.
export function normalizarConfigRanking(raw: Partial<Record<keyof ConfigRanking, unknown>> | null | undefined): ConfigRanking {
  const d = CONFIG_RANKING_DEFAULT;
  const r = raw ?? {};
  const cfg: ConfigRanking = {
    pesoVenta: numeroValido(r.pesoVenta, 0, 1) ?? d.pesoVenta,
    pesoUPT: numeroValido(r.pesoUPT, 0, 1) ?? d.pesoUPT,
    pesoAVT: numeroValido(r.pesoAVT, 0, 1) ?? d.pesoAVT,
    topeUPT: topeValido(r.topeUPT) ?? d.topeUPT,
    topeAVT: topeValido(r.topeAVT) ?? d.topeAVT,
    umbralRescate: numeroValido(r.umbralRescate, 0, 100) ?? d.umbralRescate,
    minTxnIndicadores: numeroValido(r.minTxnIndicadores, 0, 500) ?? d.minTxnIndicadores,
    ivaVentas: numeroValido(r.ivaVentas, 0, 50) ?? d.ivaVentas,
  };
  const suma = cfg.pesoVenta + cfg.pesoUPT + cfg.pesoAVT;
  if (Math.abs(suma - 1) > 0.001) {
    return { ...cfg, pesoVenta: d.pesoVenta, pesoUPT: d.pesoUPT, pesoAVT: d.pesoAVT };
  }
  return cfg;
}

export interface MetaIndicadores {
  montoTotal: number;
  metaTransacciones?: number;
  metaUnidades?: number;
  metaUPT?: number;
  metaAVT?: number;
}

// Meta UPT/AVT de la tienda: manual si la líder la definió; si no, derivada (UPT = uds/txn, AVT = monto/txn).
export function metasUptAvt(meta: MetaIndicadores | null | undefined): { upt: number | null; avt: number | null } {
  if (!meta) return { upt: null, avt: null };
  const txn = meta.metaTransacciones && meta.metaTransacciones > 0 ? meta.metaTransacciones : null;
  return {
    upt: meta.metaUPT && meta.metaUPT > 0 ? meta.metaUPT : txn && meta.metaUnidades ? meta.metaUnidades / txn : null,
    avt: meta.metaAVT && meta.metaAVT > 0 ? meta.metaAVT : txn && meta.montoTotal > 0 ? meta.montoTotal / txn : null,
  };
}

export type LimiteKpi = 'tope' | 'umbral' | 'piso' | 'minimo' | null;

export interface AporteKpi {
  real: number | null;
  meta: number | null;
  peso: number;
  pct: number | null;
  pctAplicado: number;
  puntos: number;
  limitadoPor: LimiteKpi;
}

export interface ScoreRanking {
  score: number | null;
  pctVenta: number | null;
  venta: AporteKpi;
  upt: AporteKpi;
  avt: AporteKpi;
  rescate: { habilitado: boolean; puntos: number };
  // false mientras el asesor no llegue a cfg.minTxnIndicadores transacciones en el mes.
  indicadoresActivos: boolean;
  transacciones: number;
  meta100: boolean;
  meta100PorRescate: boolean;
  faltaPara100: number;
}

export interface DatosScore {
  ventaReal: number;
  metaVenta: number;
  unidades: number;
  transacciones: number;
  metaUPT: number | null;
  metaAVT: number | null;
}

function aporteIndicador(
  real: number | null, meta: number | null, peso: number,
  rescateHabilitado: boolean, tope: number, piso: boolean, activo: boolean,
): AporteKpi {
  if (!meta || meta <= 0 || peso <= 0) {
    return { real, meta, peso: 0, pct: null, pctAplicado: 0, puntos: 0, limitadoPor: null };
  }
  const pct = real !== null ? (real / meta) * 100 : null;
  // Bajo el mínimo de ventas el UPT/AVT no es confiable: no suma nada, salvo el piso (exactamente 100%,
  // sin extra) para no quitarle el 100 a quien ya cumplió en dinero.
  if (!activo) {
    return piso
      ? { real, meta, peso, pct, pctAplicado: 100, puntos: 100 * peso, limitadoPor: 'piso' }
      : { real, meta, peso, pct, pctAplicado: 0, puntos: 0, limitadoPor: 'minimo' };
  }
  const techo = rescateHabilitado ? (tope > 0 ? tope : Infinity) : 100;
  let pctAplicado = Math.min(pct ?? 0, techo);
  let limitadoPor: LimiteKpi = pct !== null && pct > techo ? (rescateHabilitado ? 'tope' : 'umbral') : null;
  if (piso && pctAplicado < 100) {
    pctAplicado = 100;
    limitadoPor = 'piso';
  }
  return { real, meta, peso, pct, pctAplicado, puntos: pctAplicado * peso, limitadoPor };
}

export function calcularScoreRanking(d: DatosScore, cfg: ConfigRanking = CONFIG_RANKING_DEFAULT): ScoreRanking {
  const pctVenta = d.metaVenta > 0 ? (d.ventaReal / d.metaVenta) * 100 : null;
  const uptReal = d.transacciones > 0 ? d.unidades / d.transacciones : null;
  const avtReal = d.transacciones > 0 ? d.ventaReal / d.transacciones : null;

  const pesoUPT = d.metaUPT && d.metaUPT > 0 ? cfg.pesoUPT : 0;
  const pesoAVT = d.metaAVT && d.metaAVT > 0 ? cfg.pesoAVT : 0;
  const pesoVenta = cfg.pesoVenta + (cfg.pesoUPT - pesoUPT) + (cfg.pesoAVT - pesoAVT);

  const rescateHabilitado = pctVenta !== null && pctVenta >= cfg.umbralRescate;
  const piso = pctVenta !== null && pctVenta >= 100;
  const indicadoresActivos = d.transacciones >= cfg.minTxnIndicadores;

  const venta: AporteKpi = pctVenta === null
    ? { real: d.ventaReal, meta: null, peso: pesoVenta, pct: null, pctAplicado: 0, puntos: 0, limitadoPor: null }
    : { real: d.ventaReal, meta: d.metaVenta, peso: pesoVenta, pct: pctVenta, pctAplicado: pctVenta, puntos: pctVenta * pesoVenta, limitadoPor: null };
  const upt = aporteIndicador(uptReal, d.metaUPT, pesoUPT, rescateHabilitado, cfg.topeUPT, piso, indicadoresActivos);
  const avt = aporteIndicador(avtReal, d.metaAVT, pesoAVT, rescateHabilitado, cfg.topeAVT, piso, indicadoresActivos);

  // Redondeo a 4 decimales para que 95/120/120 dé exactamente 100 (evita 99.99999999).
  const score = pctVenta === null ? null : Math.round((venta.puntos + upt.puntos + avt.puntos) * 10000) / 10000;
  const rescatePts = Math.max(0, upt.pctAplicado - 100) * upt.peso + Math.max(0, avt.pctAplicado - 100) * avt.peso;
  const meta100 = (pctVenta ?? 0) >= 100 || (score ?? 0) >= 100;
  return {
    score,
    pctVenta,
    venta,
    upt,
    avt,
    rescate: { habilitado: rescateHabilitado, puntos: Math.round(rescatePts * 10000) / 10000 },
    indicadoresActivos,
    transacciones: d.transacciones,
    meta100,
    meta100PorRescate: meta100 && (pctVenta ?? 0) < 100,
    faltaPara100: score === null ? 0 : Math.max(0, 100 - score),
  };
}

// Orden del ranking mensual: score desc; desempate por dinero real. Sin meta (score null) van al final.
export function compararRanking(
  a: { score: number | null; ventaReal: number },
  b: { score: number | null; ventaReal: number },
): number {
  if (a.score !== b.score) {
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  }
  return b.ventaReal - a.ventaReal;
}

// Comisión como la hoja de la empresa: el tramo (Amarillo 90 / Verde 100 / Azul 110 / Celeste 120) se decide con
// el PUNTAJE total y se paga sobre la VENTA REAL completa. Reutiliza los mismos umbrales y tasas de
// calcularComision (que no se modifica) pasando el puntaje como % de cumplimiento. Los "falta" son el dinero
// aproximado que falta vender para llegar a cada tramo (1 pt de venta = meta / (100 · pesoVenta)).
// Quita el IVA a un valor registrado con IVA: valor ÷ (1 + iva). Ej.: 154.343.050 ÷ 1,19 = 129.700.042.
export function sinIva(valor: number, ivaPct: number): number {
  return ivaPct > 0 ? valor / (1 + ivaPct / 100) : valor;
}

export function calcularComisionPorPuntaje(
  metaAsignada: number, montoVendido: number, score: number | null, pesoVenta: number, ivaPct = 0,
): ComisionResult & { pago: number; baseSinIva: number } {
  const s = score ?? 0;
  const tramo = calcularComision(100, s);
  const aDinero = (nivel: number) =>
    metaAsignada > 0 && pesoVenta > 0 ? Math.max(0, ((nivel - s) * metaAsignada) / (100 * pesoVenta)) : 0;
  return {
    pct: s,
    talento: tramo.talento,
    comision: tramo.comision,
    falta90: aDinero(90),
    falta100: aDinero(100),
    falta110: aDinero(110),
    falta120: aDinero(120),
    baseSinIva: sinIva(montoVendido, ivaPct),
    pago: tramo.comision !== null ? (sinIva(montoVendido, ivaPct) * tramo.comision) / 100 : 0,
  };
}
