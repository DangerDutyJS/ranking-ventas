// IVA por mes: desde diciembre 2026 se descuenta al registrar y nunca otra vez al pagar. Correr con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularComisionPorPuntaje, CONFIG_RANKING_DEFAULT } from '../src/lib/reglas.ts';
import {
  registraSinIva, ivaDelMes, ivaAlRegistrar, ivaAlPagar, montoARegistrar, montoFactura,
  convertirVentasSinIva, convertirMetaSinIva,
} from '../src/lib/iva.ts';

const cfg = CONFIG_RANKING_DEFAULT;

test('noviembre se registra con IVA; diciembre en adelante sin IVA', () => {
  assert.equal(registraSinIva('2026-11'), false);
  assert.equal(registraSinIva('2026-12'), true);
  assert.equal(registraSinIva('2027-01'), true);
});

test('IVA del mes: el de la meta, o el general (19) si la meta no lo trae o es inválido', () => {
  assert.equal(ivaDelMes({ ivaVentas: 5 }, cfg), 5);
  assert.equal(ivaDelMes({ ivaVentas: 0 }, cfg), 0);
  assert.equal(ivaDelMes({}, cfg), 19);
  assert.equal(ivaDelMes(null, cfg), 19);
  assert.equal(ivaDelMes({ ivaVentas: 80 }, cfg), 19);
});

test('el IVA se descuenta en un solo lugar: al registrar (dic+) o al pagar (nov)', () => {
  assert.deepEqual([ivaAlRegistrar('2026-11', null, cfg), ivaAlPagar('2026-11', null, cfg)], [0, 19]);
  assert.deepEqual([ivaAlRegistrar('2026-12', null, cfg), ivaAlPagar('2026-12', null, cfg)], [19, 0]);
  assert.deepEqual([ivaAlRegistrar('2026-12', { ivaVentas: 5 }, cfg), ivaAlPagar('2026-12', { ivaVentas: 5 }, cfg)], [5, 0]);
});

test('factura → sin IVA (caso del gerente) y vuelta a factura para editar', () => {
  assert.equal(montoARegistrar(154343050, 19), 129700042.02);
  assert.equal(montoFactura(129700042.02, 19), 154343050);
  assert.equal(montoARegistrar(100000, 19), 84033.61);
  assert.equal(montoFactura(84033.61, 19), 100000);
  assert.equal(montoARegistrar(100000, 0), 100000);
  assert.equal(montoFactura(100000, 0), 100000);
});

test('misma comisión de Tamayo por los dos caminos (sin doble descuento)', () => {
  // Noviembre: guardado con IVA, se quita al pagar.
  const nov = calcularComisionPorPuntaje(161840000, 154343050, 102.75, 0.8, ivaAlPagar('2026-11', null, cfg));
  // Diciembre: se guardó ya sin IVA, al pagar no se vuelve a quitar.
  const guardado = montoARegistrar(154343050, ivaAlRegistrar('2026-12', null, cfg));
  const dic = calcularComisionPorPuntaje(136000000, guardado, 102.75, 0.8, ivaAlPagar('2026-12', null, cfg));
  assert.ok(Math.abs(nov.pago - 1426700.46) < 0.01, `nov ${nov.pago}`);
  assert.ok(Math.abs(dic.pago - nov.pago) < 0.01, `dic ${dic.pago} vs nov ${nov.pago}`);
  assert.equal(dic.talento, nov.talento);
});

test('un mes viejo convertido por la líder pasa a sin IVA (y no se descuenta otra vez al pagar)', () => {
  const conv = { ventasSinIva: true, ivaVentas: 19 };
  assert.equal(registraSinIva('2026-11', conv), true);
  assert.deepEqual([ivaAlRegistrar('2026-11', conv, cfg), ivaAlPagar('2026-11', conv, cfg)], [19, 0]);
});

test('conversión de noviembre: ventas, registros, acumulados y metas ÷ 1,19; txn/uds intactos', () => {
  const v = convertirVentasSinIva({
    totalVentas: 154343050, totalTransacciones: 261, totalUnidades: 579,
    registros: [{ monto: 119000, unidades: 2, transacciones: 1 }],
    acumulados: [{ monto: 238000, unidades: 1, transacciones: 1 }],
    acumuladoMes: { monto: 238000, unidades: 1, transacciones: 1 },
  }, 19);
  assert.equal(v.totalVentas, 129700042.02);
  assert.equal(v.registros?.[0].monto, 100000);
  assert.equal(v.registros?.[0].unidades, 2);
  assert.equal(v.acumulados?.[0].monto, 200000);
  assert.equal(v.acumuladoMes?.monto, 200000);
  assert.equal('totalTransacciones' in v, false);
  const m = convertirMetaSinIva({ montoTotal: 161840000, metaAVT: 435475.69, metasPorDia: { '1': { monto: 1190000, avt: 119000 } } }, 19);
  assert.equal(m.montoTotal, 136000000);
  assert.equal(m.metaAVT, 365945.96); // = Meta AVT de la hoja de la empresa
  assert.deepEqual(m.metasPorDia?.['1'], { monto: 1000000, avt: 100000 });
  assert.equal(m.ventasSinIva, true);
  // Comisión de Tamayo igual antes y después de convertir.
  const antes = calcularComisionPorPuntaje(161840000, 154343050, 102.75, 0.8, ivaAlPagar('2026-11', null, cfg));
  const despues = calcularComisionPorPuntaje(m.montoTotal!, v.totalVentas!, 102.75, 0.8, ivaAlPagar('2026-11', m, cfg));
  assert.ok(Math.abs(antes.pago - despues.pago) < 0.01, `${antes.pago} vs ${despues.pago}`);
});
