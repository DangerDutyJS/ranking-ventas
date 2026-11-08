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
// - "Rescate": UPT/AVT sobre 100% suman puntos extra solo si %Venta ≥ umbralRescate (85 por defecto),
//   y como máximo hasta topeUPT/topeAVT (130%). Si no se alcanza el umbral, UPT/AVT cuentan máx. 100%.
// - Piso de protección: si %Venta ≥ 100, UPT/AVT nunca cuentan menos de 100% (no le quitan el 100%
//   a quien ya trajo toda la plata).
// - Si la tienda no tiene meta de UPT/AVT, su peso pasa a la venta.
// - Premios/comisiones: el score ≥ 100 desbloquea SOLO el escalón del 100% (Pin, comisión Verde);
//   110%/120% y la base de pago siguen exigiendo el % de venta real (calcularComisionConRescate).

export interface ConfigRanking {
  pesoVenta: number;
  pesoUPT: number;
  pesoAVT: number;
  topeUPT: number;
  topeAVT: number;
  umbralRescate: number;
}

export const CONFIG_RANKING_DEFAULT: ConfigRanking = {
  pesoVenta: 0.8,
  pesoUPT: 0.1,
  pesoAVT: 0.1,
  topeUPT: 130,
  topeAVT: 130,
  umbralRescate: 85,
};

function numeroValido(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

// Valida lo leído de Firestore; cualquier valor ausente o fuera de rango cae al valor por defecto.
export function normalizarConfigRanking(raw: Partial<Record<keyof ConfigRanking, unknown>> | null | undefined): ConfigRanking {
  const d = CONFIG_RANKING_DEFAULT;
  const r = raw ?? {};
  const cfg: ConfigRanking = {
    pesoVenta: numeroValido(r.pesoVenta, 0, 1) ?? d.pesoVenta,
    pesoUPT: numeroValido(r.pesoUPT, 0, 1) ?? d.pesoUPT,
    pesoAVT: numeroValido(r.pesoAVT, 0, 1) ?? d.pesoAVT,
    topeUPT: numeroValido(r.topeUPT, 100, 300) ?? d.topeUPT,
    topeAVT: numeroValido(r.topeAVT, 100, 300) ?? d.topeAVT,
    umbralRescate: numeroValido(r.umbralRescate, 0, 100) ?? d.umbralRescate,
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

export type LimiteKpi = 'tope' | 'umbral' | 'piso' | null;

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
  rescateHabilitado: boolean, tope: number, piso: boolean,
): AporteKpi {
  if (!meta || meta <= 0 || peso <= 0) {
    return { real, meta, peso: 0, pct: null, pctAplicado: 0, puntos: 0, limitadoPor: null };
  }
  const pct = real !== null ? (real / meta) * 100 : null;
  const techo = rescateHabilitado ? tope : 100;
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

  const venta: AporteKpi = pctVenta === null
    ? { real: d.ventaReal, meta: null, peso: pesoVenta, pct: null, pctAplicado: 0, puntos: 0, limitadoPor: null }
    : { real: d.ventaReal, meta: d.metaVenta, peso: pesoVenta, pct: pctVenta, pctAplicado: pctVenta, puntos: pctVenta * pesoVenta, limitadoPor: null };
  const upt = aporteIndicador(uptReal, d.metaUPT, pesoUPT, rescateHabilitado, cfg.topeUPT, piso);
  const avt = aporteIndicador(avtReal, d.metaAVT, pesoAVT, rescateHabilitado, cfg.topeAVT, piso);

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

// Comisión con rescate: el score ≥ 100 solo desbloquea el escalón Verde (100%). 110%/120% y la base
// en dinero siguen dependiendo de la venta real (calcularComision no se modifica).
export function calcularComisionConRescate(
  metaAsignada: number, montoVendido: number, score: number | null,
): ComisionResult & { porRescate: boolean } {
  const base = calcularComision(metaAsignada, montoVendido);
  if (score !== null && score >= 100 && base.pct < 100) {
    return { ...base, talento: 'verde', comision: 1.10, falta90: 0, falta100: 0, porRescate: true };
  }
  return { ...base, porRescate: false };
}
