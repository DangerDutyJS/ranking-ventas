// Capa de motivación: SOLO LECTURA. Ninguna función de aquí escribe en Firestore ni altera
// el orden del ranking o los topes de beneficios; los umbrales se importan de reglas.ts.
import { SIGUIENTE_NIVEL, totalReal } from '@/lib/reglas';

export interface RegistroLite {
  monto: number;
  unidades: number;
  transacciones: number;
  fecha: string;
  creadoEn?: string;
}

export interface DocVentas {
  mes: string;
  asesorId: string;
  totalVentas?: number;
  acumuladoMes?: { monto: number };
  registros?: RegistroLite[];
}

export function fechaLocal(d: Date) {
  return d.toLocaleDateString('fr-CA');
}

export function restarDias(fecha: string, n: number) {
  const [y, m, d] = fecha.split('-').map(Number);
  return fechaLocal(new Date(y, m - 1, d - n));
}

export function diaSemana(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// ── Rachas ────────────────────────────────────────────────────────────────

export interface Racha {
  dias: number;
  hoyRegistrado: boolean;
}

// Racha = días seguidos registrando ventas. Solo se cuentan los días en que la tienda tuvo
// actividad (alguien registró): si la tienda no abrió, la racha no se rompe. Tampoco se rompe en
// los días que la líder no le asignó al asesor (noTrabaja) ni hoy mientras el día no termina.
export function calcularRacha(
  asesorId: string,
  docs: DocVentas[],
  hoy: string,
  noTrabaja?: (fecha: string) => boolean,
): Racha {
  const propias = new Set<string>();
  const tienda = new Set<string>();
  for (const d of docs) {
    for (const r of d.registros ?? []) {
      tienda.add(r.fecha);
      if (d.asesorId === asesorId) propias.add(r.fecha);
    }
  }
  const dias = [...tienda].filter((f) => f <= hoy).sort().reverse();
  let n = 0;
  for (const f of dias) {
    if (propias.has(f)) { n++; continue; }
    if (f === hoy) continue;
    if (noTrabaja?.(f)) continue;
    break;
  }
  return { dias: n, hoyRegistrado: propias.has(hoy) };
}

const HITOS_RACHA = [3, 5, 7, 10, 15, 20, 25, 30];

export function mensajeRacha(dias: number, diaNuevo: boolean): string {
  if (!diaNuevo) return `Racha de ${dias} ${dias === 1 ? 'día' : 'días'} asegurada por hoy. ¡Sigue sumando ventas!`;
  if (dias <= 1) return 'Arrancaste tu racha hoy. Registra mañana y van 2 días seguidos.';
  if (HITOS_RACHA.includes(dias)) return `¡${dias} días seguidos registrando! Esa constancia es la que hace campeones.`;
  return `¡${dias} días seguidos! No sueltes la racha mañana.`;
}

// ── Récord personal ───────────────────────────────────────────────────────

// Solo cuentan meses REPRESENTATIVOS (total ≥ minimo, p. ej. 50% de la meta actual del asesor): un mes casi
// vacío o de pruebas no puede convertirse en "récord" y producir porcentajes absurdos (+3900%).
export function mejorMesAnterior(docs: DocVentas[], asesorId: string, mesActual: string, minimo = 0) {
  let mejor: { total: number; mes: string } | null = null;
  for (const d of docs) {
    if (d.asesorId !== asesorId || d.mes >= mesActual) continue;
    const t = totalReal(d);
    if (t > 0 && t >= minimo && (!mejor || t > mejor.total)) mejor = { total: t, mes: d.mes };
  }
  return mejor;
}

// Un mes previo es representativo si llegó al 50% de la meta mensual actual del asesor. Sin meta no hay
// referencia confiable y no se calcula récord.
export function minimoRecord(metaMensual: number) {
  return metaMensual > 0 ? metaMensual * 0.5 : Infinity;
}

export function nombreMes(mes: string) {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
}

// ── Ritmo hacia la siguiente comisión ─────────────────────────────────────

// Siguiente tramo de comisión según el PUNTAJE total (como la hoja). El dinero por día es aproximado:
// cuenta solo el aporte de la venta (1 pt = meta / (100 · pesoVenta)).
export function ritmoSiguienteNivel(score: number | null, metaMensual: number, pesoVenta: number, diasRestantes: number) {
  if (score === null || metaMensual <= 0 || pesoVenta <= 0) return null;
  const nivel = SIGUIENTE_NIVEL.find((n) => score < n.pct);
  if (!nivel) return null;
  const falta = ((nivel.pct - score) * metaMensual) / (100 * pesoVenta);
  const dias = Math.max(1, diasRestantes);
  return { label: nivel.label, tasa: nivel.tasa, falta, porDia: falta / dias, dias };
}

// ── Mensaje según rendimiento (tono siempre positivo) ─────────────────────

const MENSAJES_RENDIMIENTO: { desde: number; textos: string[] }[] = [
  { desde: 120, textos: ['Estás en otro nivel. Eres el ejemplo del equipo.', 'Nivel máximo. ¡Lo que haces hoy inspira a todos!'] },
  { desde: 100, textos: ['¡Meta cumplida! Todo lo que vendas ahora te acerca al siguiente premio.', 'Ya superaste tu meta. ¡Vamos por más!'] },
  { desde: 75,  textos: ['Estás muy cerca de tu meta. Cada cliente cuenta.', 'La meta ya se ve. ¡Un empujón más!'] },
  { desde: 50,  textos: ['Vas a mitad de camino y con buen ritmo.', 'Buen paso: la segunda mitad del camino se hace venta a venta.'] },
  { desde: 0,   textos: ['Cada venta construye tu mes. ¡La próxima puede ser la grande!', 'Lo importante es sumar. ¡Vas bien, sigue así!'] },
];

export function mensajeRendimiento(pct: number, semilla: number): string {
  const grupo = MENSAJES_RENDIMIENTO.find((g) => pct >= g.desde) ?? MENSAJES_RENDIMIENTO[MENSAJES_RENDIMIENTO.length - 1];
  return grupo.textos[Math.abs(semilla) % grupo.textos.length];
}

// ── Consejos de venta (ropa y tenis) según el indicador más bajo ──────────

export type IndicadorTip = 'upt' | 'avt' | 'txn';

const TIPS: Record<IndicadorTip, string[]> = {
  upt: [
    'Con cada par de tenis ofrece medias, plantillas o un limpiador: es la forma más fácil de subir tus unidades.',
    'Arma el look completo: si lleva camiseta, muéstrale la gorra o la pantaloneta que le combina.',
    'Antes de cobrar pregunta: "¿Te muestro algo que le combine?". Una pregunta puede sumar una unidad.',
  ],
  avt: [
    'Muestra primero la referencia de gama media-alta: es más fácil bajar de precio que subir.',
    'Habla de beneficios: comodidad, duración y tecnología justifican un mejor precio.',
    'Si el cliente duda entre dos opciones, explícale por qué la superior vale la diferencia.',
  ],
  txn: [
    'Saluda a cada cliente en los primeros 10 segundos: un cliente bien recibido compra más.',
    'Acércate a quien se está midiendo algo: es el momento en que está más cerca de comprar.',
    'Si alguien se va sin comprar, invítalo a volver con una novedad o promoción.',
  ],
};

export const NOMBRE_INDICADOR: Record<IndicadorTip, string> = {
  upt: 'unidades por venta',
  avt: 'ticket promedio',
  txn: 'número de ventas',
};

// Devuelve el indicador más rezagado (<100% de su meta) o null si no hace falta consejo.
export function indicadorMasBajo(pcts: Record<IndicadorTip, number | null>): IndicadorTip | null {
  let peor: IndicadorTip | null = null;
  for (const k of Object.keys(pcts) as IndicadorTip[]) {
    const v = pcts[k];
    if (v === null || v >= 100) continue;
    if (peor === null || v < (pcts[peor] as number)) peor = k;
  }
  return peor;
}

export function tipVentas(ind: IndicadorTip, semilla: number) {
  const lista = TIPS[ind];
  return lista[Math.abs(semilla) % lista.length];
}

// ── Insignias del mes (calculadas al vuelo, no se guardan) ────────────────

export interface Insignia {
  id: string;
  emoji: string;
  label: string;
}

export function calcularInsignias(docsMes: DocVentas[], hoy: string): Record<string, Insignia[]> {
  const res: Record<string, Insignia[]> = {};
  const add = (id: string, ins: Insignia) => { (res[id] ??= []).push(ins); };

  let primera: { asesorId: string; creadoEn: string } | null = null;
  let maxMonto = 0;
  let maxUds = 0;
  for (const d of docsMes) {
    for (const r of d.registros ?? []) {
      if (r.fecha === hoy && r.creadoEn && (!primera || r.creadoEn < primera.creadoEn)) {
        primera = { asesorId: d.asesorId, creadoEn: r.creadoEn };
      }
      maxMonto = Math.max(maxMonto, r.monto);
      maxUds = Math.max(maxUds, r.unidades);
    }
  }
  if (primera) add(primera.asesorId, { id: 'primera', emoji: '☀️', label: 'Primera venta del día' });
  for (const d of docsMes) {
    const regs = d.registros ?? [];
    if (maxMonto > 0 && regs.some((r) => r.monto === maxMonto)) add(d.asesorId, { id: 'monto', emoji: '💎', label: 'Venta más alta del mes' });
    if (maxUds >= 2 && regs.some((r) => r.unidades === maxUds)) add(d.asesorId, { id: 'uds', emoji: '🛍️', label: 'Más unidades en una venta' });
  }
  return res;
}

// ── Mayor progreso de la semana ───────────────────────────────────────────

// Compara los últimos 7 días con los 7 anteriores en términos relativos, para que gane quien más
// mejoró respecto a sí mismo y no siempre quien más vende.
export function mayorProgresoSemana(docs: DocVentas[], hoy: string): { asesorId: string; pct: number } | null {
  const ini = restarDias(hoy, 6);
  const iniPrev = restarDias(hoy, 13);
  const finPrev = restarDias(hoy, 7);
  const sumas: Record<string, { act: number; prev: number }> = {};
  for (const d of docs) {
    for (const r of d.registros ?? []) {
      const s = (sumas[d.asesorId] ??= { act: 0, prev: 0 });
      if (r.fecha >= ini && r.fecha <= hoy) s.act += r.monto;
      else if (r.fecha >= iniPrev && r.fecha <= finPrev) s.prev += r.monto;
    }
  }
  let mejor: { asesorId: string; pct: number } | null = null;
  for (const [asesorId, { act, prev }] of Object.entries(sumas)) {
    if (prev <= 0 || act <= prev) continue;
    const pct = ((act - prev) / prev) * 100;
    if (!mejor || pct > mejor.pct) mejor = { asesorId, pct };
  }
  return mejor;
}

// ── Hitos del equipo ──────────────────────────────────────────────────────

const HITOS_EQUIPO = [50, 75, 100];

export function hitoEquipoCruzado(pctAntes: number, pctAhora: number): number | null {
  const cruzados = HITOS_EQUIPO.filter((h) => pctAntes < h && pctAhora >= h);
  return cruzados.length ? cruzados[cruzados.length - 1] : null;
}

// ── Retos relámpago ───────────────────────────────────────────────────────

// horaLimite "HH:MM" del día de la dinámica. Devuelve minutos restantes (negativo = terminó).
export function minutosRestantes(fecha: string, horaLimite: string, ahora: Date) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = horaLimite.split(':').map(Number);
  const limite = new Date(y, m - 1, d, hh, mm);
  return Math.ceil((limite.getTime() - ahora.getTime()) / 60000);
}

export function formatoRestante(min: number) {
  if (min <= 0) return 'Terminó';
  const h = Math.floor(min / 60);
  const r = min % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}
