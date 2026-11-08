// Lógica compartida de lo que pasa al registrar una venta (recuadro del día y del mes): posición en el
// ranking, mensajes motivacionales y datos de la placa animada. Solo LEE reglas; no escribe nada.
import {
  mensajeRacha, mensajeRendimiento, ritmoSiguienteNivel, indicadorMasBajo, tipVentas, nombreMes,
  NOMBRE_INDICADOR, type Racha, type IndicadorTip,
} from '@/lib/motivacion';
import { calcularScoreRanking, compararRanking, type ConfigRanking } from '@/lib/reglas';
import type { DatosPlaca, MensajePlaca } from '@/components/PlacaReconocimiento';

export interface ContextoMotivacion {
  racha: Racha;
  mejorMes: { total: number; mes: string } | null;
  metaMensual: number;
  diasRestantes: number;
  avanceMes: number;
  totales: { unidades: number; transacciones: number };
  metas: { avt: number | null; upt: number | null; txn: number | null };
  cfg: ConfigRanking;
}

export interface Motivacion {
  // null cuando la entrada no cuenta para la racha (acumulado del mes cargado sin fecha de venta).
  racha: { dias: number; diaNuevo: boolean } | null;
  pct: number | null;
  recordNuevo: boolean;
  nivelNuevo: 100 | 110 | 120 | null;
  score: number | null;
  rescate100Nuevo: boolean;
  rendimiento: string | null;
  record: string | null;
  ritmo: { label: string; porDia: number; dias: number } | null;
  tip: { indicador: IndicadorTip; texto: string } | null;
}

export interface PosicionMes {
  id: string;
  nombre: string;
  total: number;
  score: number | null;
}

export interface Resultado {
  posicion: number;
  subio: boolean;
  total: number;
  arriba: { nombre: string; gap: number; unidad: 'pts' | '$' } | null;
  abajo: { nombre: string; ventaja: number; unidad: 'pts' | '$' } | null;
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

// Se calcula al instante con la venta recién sumada, igual que la posición: no espera al snapshot.
export function calcularMotivacion(
  ctx: ContextoMotivacion,
  totalAntes: number,
  venta: { monto: number; unidades: number; transacciones: number },
  yaRegistroHoy: boolean,
  cuentaRacha = true,
): Motivacion {
  const semilla = Date.now();
  const diaNuevo = !ctx.racha.hoyRegistrado && !yaRegistroHoy;
  const dias = diaNuevo ? ctx.racha.dias + 1 : Math.max(1, ctx.racha.dias);
  const total = totalAntes + venta.monto;
  const pct = ctx.metaMensual > 0 ? (total / ctx.metaMensual) * 100 : null;

  let record: string | null = null;
  if (ctx.mejorMes && total > ctx.mejorMes.total) {
    record = totalAntes <= ctx.mejorMes.total
      ? `¡Superaste tu mejor mes (${nombreMes(ctx.mejorMes.mes)})! Nuevo récord personal.`
      : `Vas por encima de tu mejor mes (${nombreMes(ctx.mejorMes.mes)}). Cada venta agranda tu récord.`;
  }

  const uds = ctx.totales.unidades + venta.unidades;
  const txn = ctx.totales.transacciones + venta.transacciones;
  const upt = txn > 0 ? uds / txn : null;
  const avt = txn > 0 ? total / txn : null;
  // Transacciones se compara contra lo esperado a esta altura del mes, no contra la meta completa.
  const txnEsperadas = ctx.metas.txn !== null ? ctx.metas.txn * Math.max(0.05, ctx.avanceMes) : null;
  const indicador = indicadorMasBajo({
    upt: upt !== null && ctx.metas.upt ? (upt / ctx.metas.upt) * 100 : null,
    avt: avt !== null && ctx.metas.avt ? (avt / ctx.metas.avt) * 100 : null,
    txn: txnEsperadas ? (txn / txnEsperadas) * 100 : null,
  });

  // Puntaje ponderado antes y después (mismas reglas que el ranking mensual).
  const datosScore = (v: number, u: number, t: number) => calcularScoreRanking({
    ventaReal: v, metaVenta: ctx.metaMensual, unidades: u, transacciones: t, metaUPT: ctx.metas.upt, metaAVT: ctx.metas.avt,
  }, ctx.cfg);
  const scoreAntes = datosScore(totalAntes, ctx.totales.unidades, ctx.totales.transacciones);
  const scoreDespues = datosScore(total, uds, txn);

  const ritmo = ritmoSiguienteNivel(scoreDespues.score, ctx.metaMensual, scoreDespues.venta.peso, ctx.diasRestantes);
  // Tramo nuevo según el cumplimiento total (puntaje), igual que comisiones y premios. Solo LEE los umbrales.
  const cAntes = scoreAntes.score, cDespues = scoreDespues.score;
  const nivelNuevo = cAntes !== null && cDespues !== null
    ? ([120, 110, 100] as const).find((n) => cAntes < n && cDespues >= n) ?? null
    : null;
  return {
    racha: cuentaRacha ? { dias, diaNuevo } : null,
    pct,
    recordNuevo: !!ctx.mejorMes && totalAntes <= ctx.mejorMes.total && total > ctx.mejorMes.total,
    nivelNuevo,
    score: scoreDespues.score,
    rescate100Nuevo: scoreDespues.meta100PorRescate && !scoreAntes.meta100,
    rendimiento: pct !== null ? mensajeRendimiento(pct, semilla) : null,
    record,
    ritmo: ritmo ? { label: ritmo.label, porDia: ritmo.porDia, dias: ritmo.dias } : null,
    tip: indicador ? { indicador, texto: tipVentas(indicador, semilla) } : null,
  };
}

// Distancia entre dos asesores en la unidad que decide el orden: puntos; si empatan (o no hay meta), dinero.
function distancia(alto: { score: number | null; ventaReal: number }, bajo: { score: number | null; ventaReal: number }) {
  if (alto.score !== null && bajo.score !== null && alto.score - bajo.score > 0.05) {
    return { valor: alto.score - bajo.score, unidad: 'pts' as const };
  }
  return { valor: alto.ventaReal - bajo.ventaReal, unidad: '$' as const };
}

export function formatDistancia(valor: number, unidad: 'pts' | '$') {
  return unidad === 'pts' ? `${valor.toFixed(1)} pts` : formatCurrency(valor);
}

// Posición con el mismo orden del ranking mensual (puntaje, desempate por dinero): cuántos van delante + 1.
export function calcularResultado(ranking: PosicionMes[], asesorId: string, monto: number, scoreNuevo: number | null): Resultado {
  const otros = ranking.filter((r) => r.id !== asesorId).map((r) => ({ ...r, ventaReal: r.total }));
  const yo = ranking.find((r) => r.id === asesorId);
  const antes = { score: yo?.score ?? null, ventaReal: yo?.total ?? 0 };
  const despues = { score: scoreNuevo, ventaReal: antes.ventaReal + monto };
  const delanteAntes = otros.filter((o) => compararRanking(o, antes) < 0);
  const delante = otros.filter((o) => compararRanking(o, despues) < 0).sort(compararRanking);
  const detras = otros.filter((o) => compararRanking(o, despues) >= 0).sort(compararRanking);
  const encima = delante[delante.length - 1];
  const debajo = detras[0];
  const dArriba = encima ? distancia(encima, despues) : null;
  const dAbajo = debajo ? distancia(despues, debajo) : null;
  return {
    posicion: delante.length + 1,
    subio: delante.length < delanteAntes.length,
    total: despues.ventaReal,
    arriba: encima && dArriba ? { nombre: encima.nombre, gap: dArriba.valor, unidad: dArriba.unidad } : null,
    abajo: debajo && dAbajo ? { nombre: debajo.nombre, ventaja: dAbajo.valor, unidad: dAbajo.unidad } : null,
  };
}

// Línea de posición (sin tono negativo: del 5º en adelante no se muestra la distancia).
export function textoPosicion(r: Resultado): string {
  if (r.posicion === 1) {
    return r.abajo && r.abajo.ventaja > 0
      ? `${r.subio ? '¡Llegaste al 1º lugar!' : '¡Sigues en el 1º lugar!'} Le llevas ${formatDistancia(r.abajo.ventaja, r.abajo.unidad)} a ${r.abajo.nombre}.`
      : r.subio ? '¡Llegaste al 1º lugar!' : '¡Vas en el 1º lugar!';
  }
  if (r.posicion <= 4 && r.arriba) {
    return `${r.subio ? `¡Subiste al ${r.posicion}º lugar!` : `Vas en el ${r.posicion}º lugar.`} Estás a ${formatDistancia(r.arriba.gap, r.arriba.unidad)} de ${r.arriba.nombre}.`;
  }
  return `${r.subio ? `¡Subiste al ${r.posicion}º lugar! ` : ''}Llevas ${formatCurrency(r.total)} este mes.`;
}

const HITOS_RACHA_PLACA = [3, 5, 7, 10, 15, 20, 25, 30];
const TITULOS_GENERALES = ['¡Vas muy bien!', '¡Excelente venta!', '¡Sigue así, vas con todo!'];

// Placa: título con el logro más importante + todos los mensajes motivacionales (siempre en positivo).
export function armarPlaca(monto: number, r: Resultado | null, m: Motivacion | null): DatosPlaca {
  const semilla = Date.now();
  let titulo = TITULOS_GENERALES[semilla % TITULOS_GENERALES.length];
  if (m?.recordNuevo) titulo = '¡Nuevo récord personal!';
  else if (m?.nivelNuevo === 120) titulo = '¡Día libre desbloqueado! 🏖️';
  else if (m?.nivelNuevo === 110) titulo = '¡Bono corral desbloqueado! 🎁';
  else if (m?.rescate100Nuevo) titulo = '¡Tu UPT y AVT te llevaron al 100%! 🛟';
  else if (m?.nivelNuevo === 100) titulo = '¡Meta cumplida! 📌';
  else if (r?.subio && r.posicion === 1) titulo = '¡Llegaste al 1º lugar!';
  else if (r?.subio) titulo = `¡Subiste al ${r.posicion}º lugar!`;
  else if (m?.racha?.diaNuevo && HITOS_RACHA_PLACA.includes(m.racha.dias)) titulo = `¡Racha de ${m.racha.dias} días!`;
  else if (m?.racha?.diaNuevo) titulo = '¡Arrancaste el día!';

  const mensajes: MensajePlaca[] = [];
  if (r) mensajes.push({ icono: r.subio || r.posicion === 1 ? '🏆' : '🎯', texto: textoPosicion(r) });
  if (m?.racha) mensajes.push({ icono: '🔥', texto: mensajeRacha(m.racha.dias, m.racha.diaNuevo) });
  if (m?.record) mensajes.push({ icono: '📈', texto: m.record, tipo: 'logro' });
  if (m?.ritmo) {
    mensajes.push({
      icono: '⏱️',
      texto: `Para la comisión ${m.ritmo.label}: ${formatCurrency(m.ritmo.porDia)} por día · ${m.ritmo.dias} ${m.ritmo.dias === 1 ? 'día' : 'días'}.`,
    });
  }
  if (m?.tip) mensajes.push({ icono: '💡', texto: `Consejo para subir tu ${NOMBRE_INDICADOR[m.tip.indicador]}: ${m.tip.texto}`, tipo: 'consejo' });

  return {
    id: semilla,
    monto,
    titulo,
    frase: m?.rendimiento ?? 'Cada venta construye tu mes. ¡La próxima puede ser la grande!',
    racha: m?.racha?.dias ?? 0,
    pct: m?.score ?? m?.pct ?? null,
    posicion: r?.posicion ?? null,
    mensajes,
  };
}
