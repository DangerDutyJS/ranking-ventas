// Pruebas del puntaje ponderado del ranking. Correr con: npm test  (node --test, sin dependencias)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularScoreRanking, compararRanking, calcularComisionConRescate, calcularComision,
  normalizarConfigRanking, metasUptAvt, CONFIG_RANKING_DEFAULT, type DatosScore,
} from '../src/lib/reglas.ts';

const cerca = (a: number | null, b: number, eps = 0.01) => {
  assert.ok(a !== null && Math.abs(a - b) < eps, `esperaba ≈${b}, obtuve ${a}`);
};

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

test('ejemplo del negocio: venta 95% + UPT 120% + AVT 120% = 100 (efecto rescate)', () => {
  const r = calcularScoreRanking(datos(95, 120, 120));
  cerca(r.venta.puntos, 76);
  cerca(r.upt.puntos, 12);
  cerca(r.avt.puntos, 12);
  assert.equal(r.score, 100);
  assert.equal(r.rescate.habilitado, true);
  cerca(r.rescate.puntos, 4);
  assert.equal(r.meta100, true);
  assert.equal(r.meta100PorRescate, true);
  assert.equal(r.faltaPara100, 0);
});

test('tope: UPT 200% con venta 95% cuenta máximo 130% (13 pts)', () => {
  const r = calcularScoreRanking(datos(95, 200, 100));
  assert.equal(r.upt.pctAplicado, 130);
  assert.equal(r.upt.limitadoPor, 'tope');
  cerca(r.upt.puntos, 13);
  cerca(r.score, 76 + 13 + 10);
});

test('umbral: con venta 60% el sobrecumplimiento de UPT/AVT no suma (máx. 100%)', () => {
  const r = calcularScoreRanking(datos(60, 200, 150));
  assert.equal(r.rescate.habilitado, false);
  assert.equal(r.upt.pctAplicado, 100);
  assert.equal(r.upt.limitadoPor, 'umbral');
  assert.equal(r.avt.limitadoPor, 'umbral');
  cerca(r.score, 48 + 10 + 10);
  assert.equal(r.rescate.puntos, 0);
});

test('umbral exacto (85%) ya habilita el rescate', () => {
  const r = calcularScoreRanking(datos(85, 130, 130));
  assert.equal(r.rescate.habilitado, true);
  cerca(r.score, 68 + 13 + 13);
  assert.equal(r.meta100, false);
});

test('piso: con venta ≥ 100% un UPT/AVT bajo no le quita el 100%', () => {
  const r = calcularScoreRanking(datos(100, 70, 60));
  assert.equal(r.upt.pctAplicado, 100);
  assert.equal(r.upt.limitadoPor, 'piso');
  assert.equal(r.avt.limitadoPor, 'piso');
  assert.equal(r.score, 100);
  assert.equal(r.meta100PorRescate, false);
});

test('piso: venta 105% con UPT 70% → 84 + 10 + 10 = 104 (solo suma o mantiene)', () => {
  const r = calcularScoreRanking(datos(105, 70, 100));
  cerca(r.score, 104);
});

test('debajo de 100% en venta, un UPT bajo sí resta en el orden (calidad de venta)', () => {
  const r = calcularScoreRanking(datos(95, 70, 100));
  cerca(r.score, 76 + 7 + 10);
  assert.equal(r.upt.limitadoPor, null);
});

test('sin meta de UPT/AVT su peso pasa a la venta', () => {
  const r = calcularScoreRanking(datos(95, null, null));
  assert.equal(r.venta.peso, 1);
  cerca(r.score, 95);
  assert.equal(r.upt.puntos, 0);
});

test('sin meta de venta el score es null', () => {
  const r = calcularScoreRanking({ ventaReal: 5_000_000, metaVenta: 0, unidades: 10, transacciones: 5, metaUPT: 2, metaAVT: 1_000_000 });
  assert.equal(r.score, null);
  assert.equal(r.meta100, false);
});

test('sin transacciones, UPT y AVT aportan 0 (no hay calidad que medir)', () => {
  const r = calcularScoreRanking({ ventaReal: 90_000_000, metaVenta: 100_000_000, unidades: 0, transacciones: 0, metaUPT: 2, metaAVT: 800_000 });
  cerca(r.score, 72);
  assert.equal(r.upt.pct, null);
});

test('rescate máximo posible: con 92.5% de venta y topes llega justo a 100', () => {
  cerca(calcularScoreRanking(datos(92.5, 130, 130)).score, 100);
  assert.ok((calcularScoreRanking(datos(92, 130, 130)).score ?? 0) < 100);
});

test('compararRanking: score desc, desempate por dinero, sin meta al final', () => {
  const lista = [
    { id: 'a', score: 95, ventaReal: 10 },
    { id: 'b', score: null, ventaReal: 999 },
    { id: 'c', score: 100, ventaReal: 5 },
    { id: 'd', score: 95, ventaReal: 20 },
  ];
  assert.deepEqual([...lista].sort(compararRanking).map((x) => x.id), ['c', 'd', 'a', 'b']);
});

test('comisión con rescate: score ≥ 100 con venta 95% desbloquea solo Verde, pagado sobre la venta real', () => {
  const c = calcularComisionConRescate(100, 95, 100);
  assert.equal(c.talento, 'verde');
  assert.equal(c.comision, 1.10);
  assert.equal(c.porRescate, true);
  assert.equal(c.falta100, 0);
  cerca(c.falta110, 15);
  assert.equal(c.pct, 95);
});

test('comisión: sin rescate se comporta igual que calcularComision', () => {
  assert.deepEqual(
    { ...calcularComisionConRescate(100, 95, 99), porRescate: undefined },
    { ...calcularComision(100, 95), porRescate: undefined },
  );
  assert.equal(calcularComisionConRescate(100, 112, 105).talento, 'azul');
  assert.equal(calcularComisionConRescate(100, 112, 105).porRescate, false);
  assert.equal(calcularComisionConRescate(100, 125, 120).talento, 'celeste');
});

test('calcularComision (regla congelada) sigue igual', () => {
  assert.equal(calcularComision(100, 89.99).talento, null);
  assert.equal(calcularComision(100, 90).talento, 'amarillo');
  assert.equal(calcularComision(100, 100).comision, 1.10);
  assert.equal(calcularComision(100, 110).comision, 1.20);
  assert.equal(calcularComision(100, 120).comision, 1.30);
});

test('normalizarConfigRanking: defaults, rangos y pesos que no suman 1', () => {
  assert.deepEqual(normalizarConfigRanking(undefined), CONFIG_RANKING_DEFAULT);
  assert.equal(normalizarConfigRanking({ topeUPT: 150 }).topeUPT, 150);
  assert.equal(normalizarConfigRanking({ topeUPT: 50 }).topeUPT, 130);
  assert.equal(normalizarConfigRanking({ umbralRescate: 'x' }).umbralRescate, 85);
  const p = normalizarConfigRanking({ pesoVenta: 0.5, pesoUPT: 0.1, pesoAVT: 0.1 });
  assert.equal(p.pesoVenta, 0.8);
});

test('metasUptAvt: manual tiene prioridad sobre la derivada', () => {
  assert.deepEqual(metasUptAvt({ montoTotal: 100, metaTransacciones: 10, metaUnidades: 30 }), { upt: 3, avt: 10 });
  assert.deepEqual(metasUptAvt({ montoTotal: 100, metaTransacciones: 10, metaUnidades: 30, metaUPT: 2.5, metaAVT: 12 }), { upt: 2.5, avt: 12 });
  assert.deepEqual(metasUptAvt({ montoTotal: 100 }), { upt: null, avt: null });
});
