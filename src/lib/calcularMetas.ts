function largestRemainder(
  exactAmounts: Record<string, number>,
  total: number
): Record<string, number> {

  const rounded: Record<string, number> = {};
  let sumFloors = 0;

  const fractions: Array<{ id: string; frac: number }> = [];

  for (const [id, exact] of Object.entries(exactAmounts)) {

    const floor = Math.floor(exact);
    rounded[id] = floor;
    sumFloors += floor;
    fractions.push({
      id,
      frac: exact - floor
    });
  }

  const n = fractions.length;

  if (n === 0) return rounded;

  let remainder = Math.round(total - sumFloors);

  fractions.sort(
    (a, b) => b.frac - a.frac
  );

  // Optimización:
  // reparte bloques completos sin hacer miles/millones de vueltas
  const fullRounds = Math.floor(remainder / n);

  if (fullRounds > 0) {

    for (const item of fractions) {

      rounded[item.id] += fullRounds;

    }

    remainder -= fullRounds * n;
  }

  // entrega los residuos restantes
  // residuos finales
  for (let i = 0; i < remainder && i < fractions.length; i++) {
    rounded[fractions[i].id] += 1;
  }

  return rounded;
}

export function distribuirIndicador(
  total: number,
  asesorIds: string[],
  metaAsesores: Record<string, { diasLaborados: number }>
): Record<string, number> {

  if (!asesorIds.length || total <= 0) {
    return {};
  }

  const totalDias = asesorIds.reduce(
    (acc, id) =>
      acc + (metaAsesores[id]?.diasLaborados ?? 0),
    0
  );

  const exactAmounts: Record<string, number> = {};

  for (const id of asesorIds) {

    const dias =
      metaAsesores[id]?.diasLaborados ?? 0;
    exactAmounts[id] =
      totalDias > 0
        ? (dias / totalDias) * total
        : 0;
  }

  return largestRemainder(
    exactAmounts,
    total
  );
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

  if (!asesorIds.length) {
    return {};
  }

  const presupuestoBase =
    montoTotal / asesorIds.length;

  const totalDias = asesorIds.reduce(
    (acc, id) =>
      acc + (metaAsesores[id]?.diasLaborados ?? 0),
    0
  );
  const exactAmounts: Record<string, number> = {};

  for (const id of asesorIds) {
    const dias =
      metaAsesores[id]?.diasLaborados ?? 0;
    exactAmounts[id] =
      totalDias > 0
        ? (dias / totalDias) * montoTotal
        : 0;
  }
  const rounded =
    largestRemainder(
      exactAmounts,
      montoTotal
    );

  const result: Record<string, MetaCalculada> = {};

  for (const id of asesorIds) {

    const diasLaborados =
      metaAsesores[id]?.diasLaborados ?? 0;

    const meta =
      rounded[id];

    result[id] = {
      presupuestoBase,
      metaMensual: meta,
      redistribucion:
        meta - presupuestoBase,
      diasLaborados,
      diasMes: totalDias,
      esProporcional: true
    };

  }
  return result;
}