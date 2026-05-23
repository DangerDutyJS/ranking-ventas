function largestRemainder(exactAmounts: Record<string, number>, total: number): Record<string, number> {
  const rounded: Record<string, number> = {};
  let sumFloors = 0;
  const fractions: Array<{ id: string; frac: number }> = [];

  for (const [id, exact] of Object.entries(exactAmounts)) {
    const floor = Math.floor(exact);
    rounded[id] = floor;
    sumFloors += floor;
    fractions.push({ id, frac: exact - floor });
  }

  const n = fractions.length;
  if (n === 0) return rounded;

  let remainder = Math.round(total - sumFloors);
  fractions.sort((a, b) => b.frac - a.frac);

  const fullRounds = Math.floor(remainder / n);
  if (fullRounds > 0) {
    for (const { id } of fractions) rounded[id] += fullRounds;
    remainder -= fullRounds * n;
  }
  for (let i = 0; i < remainder; i++) {
    rounded[fractions[i].id] += 1;
  }

  return rounded;
}

export function distribuirIndicador(
  total: number,
  asesorIds: string[],
  metaAsesores: Record<string, { diasLaborados: number }>
): Record<string, number> {
  const n = asesorIds.length;
  if (n === 0 || total <= 0) return {};
  const baseUnit = total / n;
  const maxDias = Math.max(...asesorIds.map((id) => metaAsesores[id]?.diasLaborados ?? 0), 1);
  let surplus = 0;
  let numFull = 0;
  const proporcionales: Record<string, number> = {};
  for (const id of asesorIds) {
    const dias = metaAsesores[id]?.diasLaborados ?? 0;
    const prop = (dias / maxDias) * baseUnit;
    proporcionales[id] = prop;
    surplus += baseUnit - prop;
    if (dias >= maxDias) numFull++;
  }
  const extraPorFull = numFull > 0 ? surplus / numFull : 0;
  const exactAmounts: Record<string, number> = {};
  for (const id of asesorIds) {
    const esFull = (metaAsesores[id]?.diasLaborados ?? 0) >= maxDias;
    exactAmounts[id] = proporcionales[id] + (esFull ? extraPorFull : 0);
  }
  return largestRemainder(exactAmounts, total);
}

export interface MetaCalculada {
  presupuestoBase: number;
  metaMensual: number;
  redistribucion: number;
  diasLaborados: number;
  diasMes: number;
  esProporcional: boolean;
}

export function calcularMetas(
  montoTotal: number,
  asesorIds: string[],
  metaAsesores: Record<string, { diasLaborados: number }>
): Record<string, MetaCalculada> {
  const n = asesorIds.length;
  if (n === 0) return {};

  const presupuestoBase = montoTotal / n;
  const todasLosDias = asesorIds.map((id) => metaAsesores[id]?.diasLaborados ?? 0);
  const diasMes = Math.max(...todasLosDias, 1);

  let totalSurplus = 0;
  let numFull = 0;
  const proporcionales: Record<string, number> = {};

  for (const id of asesorIds) {
    const dias = metaAsesores[id]?.diasLaborados ?? 0;
    const prop = (dias / diasMes) * presupuestoBase;
    proporcionales[id] = prop;
    totalSurplus += presupuestoBase - prop;
    if (dias >= diasMes) numFull++;
  }

  const extraPorFull = numFull > 0 ? totalSurplus / numFull : 0;

  const exactAmounts: Record<string, number> = {};
  for (const id of asesorIds) {
    const diasLaborados = metaAsesores[id]?.diasLaborados ?? 0;
    const esFull = diasLaborados >= diasMes;
    exactAmounts[id] = proporcionales[id] + (esFull ? extraPorFull : 0);
  }

  const rounded = largestRemainder(exactAmounts, montoTotal);

  const result: Record<string, MetaCalculada> = {};
  for (const id of asesorIds) {
    const diasLaborados = metaAsesores[id]?.diasLaborados ?? 0;
    const esFull = diasLaborados >= diasMes;
    result[id] = {
      presupuestoBase,
      metaMensual: rounded[id],
      redistribucion: esFull ? extraPorFull : -(presupuestoBase - proporcionales[id]),
      diasLaborados,
      diasMes,
      esProporcional: !esFull,
    };
  }

  return result;
}
