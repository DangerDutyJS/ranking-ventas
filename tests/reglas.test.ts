// Pruebas del puntaje del ranking y comisiones. Correr con: npm test  (node --test, sin dependencias)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularScoreRanking, compararRanking, calcularComisionPorPuntaje, calcularComision,
  normalizarConfigRanking, metasUptAvt, CONFIG_RANKING_DEFAULT, type DatosScore, type ConfigRanking,
} from '../src/lib/reglas.ts';

const cerca = (a: number | null, b: number, eps = 0.01) => {
  assert.ok(a !== null && Math.abs(a - b) < eps, `esperaba ≈${b}, obtuve ${a}`);
};

// Parámetros de protección opcionales (tope 130% y umbral 85%), configurables por la líder.
const PROTEGIDO: ConfigRanking = { ...CONFIG_RANKING_DEFAULT, topeUPT: 130, topeAVT: 130, umbralRescate: 85 };

// Construye datos con % de cumplimiento exactos: meta venta 100M, 100 transacciones.
function datos(pctVenta: number, pctUPT: number | null, pctAVT: number | null, transacciones = 100): DatosScore {
  const metaVenta = 100_000_000;
  const ventaReal = metaVenta * pctVenta / 100;
  const unidades = 240;
  const uptReal = unidades / transacciones;
  const avtReal = ventaReal / transacciones;
  return {
    ventaReal, metaVenta, unidades, transacciones,
    metaUPT: pctUPT === null ? null : uptReal / (pctUPT / 100),
    metaAVT: pctAVT === null ? null : avtReal / (pctAVT / 100),
  };
}

// ── Datos REALES de la hoja de la empresa (noviembre 2026) ─────────────────────
// Meta venta $136.000.000 · meta UPT 1,72 · meta AVT $365.945,96 por asesor.
// El UPT real de la hoja se ve redondeado (2,0 / 2,2…), por eso se usa su % de UPT.
const META_V = 136_000_000, META_AVT = 365_945.96, META_UPT = 1.72;
function filaHoja(venta: number, pctUPT: number, avt: number): DatosScore {
  const txn = venta / avt;
  return { ventaReal: venta, metaVenta: META_V, transacciones: txn, unidades: (META_UPT * pctUPT / 100) * txn, metaUPT: META_UPT, metaAVT: META_AVT };
}
const comisionHoja = (d: DatosScore) => {
  const s = calcularScoreRanking(d);
  return { s, c: calcularComisionPorPuntaje(META_V, d.ventaReal, s.score, s.venta.peso) };
};

test('hoja real: Ramírez Camilo — 87% de venta, 93,55 pts → Amarillo 0,65% = $770.528,93', () => {
  const { s, c } = comisionHoja(filaHoja(118_542_912, 116, 448_177));
  cerca(s.score, 93.55, 0.05);
  assert.equal(c.talento, 'amarillo');
  cerca(c.pago, 770_528.93, 0.01);
});

test('hoja real: Tamayo Juan Manuel — AVT 135,5% cuenta completo, 102,75 pts → Verde 1,10% = $1.426.700,46', () => {
  const { s, c } = comisionHoja(filaHoja(129_700_042, 129, 495_985));
  cerca(s.score, 102.75, 0.05);
  assert.equal(s.avt.limitadoPor, null);
  assert.equal(c.talento, 'verde');
  cerca(c.pago, 1_426_700.46, 0.01);
});

test('hoja real: Tobón, Bustamante y Zapata — UPT/AVT suman completos aunque la venta sea baja, sin comisión', () => {
  for (const [venta, pu, avt, esperado] of [
    [80_571_613, 120, 465_732, 72.15], [72_903_979, 111, 441_842, 66.06], [66_179_681, 110, 442_180, 62.0],
  ] as const) {
    const { s, c } = comisionHoja(filaHoja(venta, pu, avt));
    cerca(s.score, esperado, 0.06);
    assert.equal(c.talento, null);
    assert.equal(c.pago, 0);
  }
});

test('por defecto (como la hoja) no hay tope ni umbral', () => {
  assert.equal(CONFIG_RANKING_DEFAULT.topeUPT, 0);
  assert.equal(CONFIG_RANKING_DEFAULT.topeAVT, 0);
  assert.equal(CONFIG_RANKING_DEFAULT.umbralRescate, 0);
  const r = calcularScoreRanking(datos(95, 200, 100));
  cerca(r.score, 76 + 20 + 10);
  assert.equal(r.upt.limitadoPor, null);
});

// ── Puntaje ────────────────────────────────────────────────────────────────
test('ejemplo del negocio: venta 95% + UPT 120% + AVT 120% = 100', () => {
  const r = calcularScoreRanking(datos(95, 120, 120));
  cerca(r.venta.puntos, 76);
  cerca(r.upt.puntos, 12);
  cerca(r.avt.puntos, 12);
  assert.equal(r.score, 100);
  cerca(r.rescate.puntos, 4);
  assert.equal(r.meta100, true);
  assert.equal(r.meta100PorRescate, true);
});

test('tope opcional: UPT 200% con tope 130 cuenta 130% (13 pts)', () => {
  const r = calcularScoreRanking(datos(95, 200, 100), PROTEGIDO);
  assert.equal(r.upt.pctAplicado, 130);
  assert.equal(r.upt.limitadoPor, 'tope');
  cerca(r.score, 76 + 13 + 10);
});

test('umbral opcional: con umbral 85 y venta 60% el sobrecumplimiento no suma', () => {
  const r = calcularScoreRanking(datos(60, 200, 150), PROTEGIDO);
  assert.equal(r.upt.limitadoPor, 'umbral');
  cerca(r.score, 48 + 10 + 10);
});

test('piso: con venta ≥ 100% un UPT/AVT bajo no le quita el 100%', () => {
  const r = calcularScoreRanking(datos(100, 70, 60));
  assert.equal(r.upt.limitadoPor, 'piso');
  assert.equal(r.score, 100);
});

test('debajo de 100% en venta, un UPT bajo sí resta', () => {
  cerca(calcularScoreRanking(datos(95, 70, 100)).score, 76 + 7 + 10);
});

test('sin meta de UPT/AVT su peso pasa a la venta', () => {
  const r = calcularScoreRanking(datos(95, null, null));
  assert.equal(r.venta.peso, 1);
  cerca(r.score, 95);
});

test('sin meta de venta el score es null', () => {
  const r = calcularScoreRanking({ ventaReal: 5_000_000, metaVenta: 0, unidades: 10, transacciones: 5, metaUPT: 2, metaAVT: 1_000_000 });
  assert.equal(r.score, null);
});

test('mínimo de ventas: con 2 transacciones UPT/AVT no suman', () => {
  const r = calcularScoreRanking({ ventaReal: 250_000, metaVenta: 10_000_000, unidades: 6, transacciones: 2, metaUPT: 2.5, metaAVT: 100_000 });
  assert.equal(r.upt.limitadoPor, 'minimo');
  cerca(r.score, 2);
});

test('mínimo de ventas: desde la transacción 10 ya cuentan', () => {
  const r = calcularScoreRanking({ ventaReal: 1_000_000, metaVenta: 10_000_000, unidades: 25, transacciones: 10, metaUPT: 2.5, metaAVT: 100_000 });
  cerca(r.score, 8 + 10 + 10);
});

test('mínimo de ventas no rompe el piso', () => {
  const r = calcularScoreRanking({ ventaReal: 10_000_000, metaVenta: 10_000_000, unidades: 5, transacciones: 4, metaUPT: 2.5, metaAVT: 100_000 });
  assert.equal(r.score, 100);
});

test('compararRanking: score desc, desempate por dinero, sin meta al final', () => {
  const lista = [
    { id: 'a', score: 95, ventaReal: 10 }, { id: 'b', score: null, ventaReal: 999 },
    { id: 'c', score: 100, ventaReal: 5 }, { id: 'd', score: 95, ventaReal: 20 },
  ];
  assert.deepEqual([...lista].sort(compararRanking).map((x) => x.id), ['c', 'd', 'a', 'b']);
});

// ── Comisión por puntaje ──────────────────────────────────────────────────────
test('comisión: el tramo sale del puntaje y se paga sobre la venta completa', () => {
  assert.equal(calcularComisionPorPuntaje(100, 85, 89.99, 0.8).talento, null);
  assert.equal(calcularComisionPorPuntaje(100, 85, 90, 0.8).talento, 'amarillo');
  assert.equal(calcularComisionPorPuntaje(100, 95, 100, 0.8).talento, 'verde');
  assert.equal(calcularComisionPorPuntaje(100, 105, 110, 0.8).talento, 'azul');
  assert.equal(calcularComisionPorPuntaje(100, 115, 120, 0.8).talento, 'celeste');
  cerca(calcularComisionPorPuntaje(100, 95, 100, 0.8).pago, 95 * 1.1 / 100);
});

test('comisión: "falta" es el dinero aproximado para el siguiente tramo (1 pt = meta/80)', () => {
  const c = calcularComisionPorPuntaje(136_000_000, 118_542_912, 93.55, 0.8);
  cerca(c.falta100, (100 - 93.55) * 136_000_000 / 80, 1);
  assert.equal(c.falta90, 0);
});

test('calcularComision (regla congelada) sigue igual', () => {
  assert.equal(calcularComision(100, 89.99).talento, null);
  assert.equal(calcularComision(100, 90).talento, 'amarillo');
  assert.equal(calcularComision(100, 100).comision, 1.10);
  assert.equal(calcularComision(100, 110).comision, 1.20);
  assert.equal(calcularComision(100, 120).comision, 1.30);
});

// ── Configuración ─────────────────────────────────────────────────────────────
test('normalizarConfigRanking: defaults, tope 0 o 100–1000, umbral 0–100', () => {
  assert.deepEqual(normalizarConfigRanking(undefined), CONFIG_RANKING_DEFAULT);
  assert.equal(normalizarConfigRanking({ topeUPT: 130 }).topeUPT, 130);
  assert.equal(normalizarConfigRanking({ topeUPT: 0 }).topeUPT, 0);
  assert.equal(normalizarConfigRanking({ topeUPT: 50 }).topeUPT, 0);
  assert.equal(normalizarConfigRanking({ umbralRescate: 85 }).umbralRescate, 85);
  assert.equal(normalizarConfigRanking({ minTxnIndicadores: -3 }).minTxnIndicadores, 10);
  assert.equal(normalizarConfigRanking({ pesoVenta: 0.5, pesoUPT: 0.1, pesoAVT: 0.1 }).pesoVenta, 0.8);
});

test('metasUptAvt: manual tiene prioridad sobre la derivada', () => {
  assert.deepEqual(metasUptAvt({ montoTotal: 100, metaTransacciones: 10, metaUnidades: 30 }), { upt: 3, avt: 10 });
  assert.deepEqual(metasUptAvt({ montoTotal: 100, metaTransacciones: 10, metaUnidades: 30, metaUPT: 2.5, metaAVT: 12 }), { upt: 2.5, avt: 12 });
});
