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
  const result: Record<string, MetaCalculada> = {};

  for (const id of asesorIds) {
    const diasLaborados = metaAsesores[id]?.diasLaborados ?? 0;
    const esFull = diasLaborados >= diasMes;
    result[id] = {
      presupuestoBase,
      metaMensual: proporcionales[id] + (esFull ? extraPorFull : 0),
      redistribucion: esFull ? extraPorFull : -(presupuestoBase - proporcionales[id]),
      diasLaborados,
      diasMes,
      esProporcional: !esFull,
    };
  }

  return result;
}
