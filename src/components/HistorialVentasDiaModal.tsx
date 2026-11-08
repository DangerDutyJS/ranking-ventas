'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';
import { crearNotificacion } from '@/lib/notificaciones';
import Image from 'next/image';
import PlacaReconocimiento, { type DatosPlaca } from '@/components/PlacaReconocimiento';
import {
  mensajeRacha, mensajeRendimiento, ritmoSiguienteNivel, indicadorMasBajo, tipVentas, nombreMes,
  minutosRestantes, NOMBRE_INDICADOR, type Racha, type IndicadorTip,
} from '@/lib/motivacion';
import { calcularScoreRanking, compararRanking, type ConfigRanking } from '@/lib/reglas';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  fotoBase64: string;
}

interface Registro {
  id?: string;
  monto: number;
  unidades: number;
  transacciones: number;
  fecha: string;
  creadoEn: string;
}

interface Dinamica {
  id: string;
  nombre: string;
  meta: number;
  fecha?: string;
  horaLimite?: string;
  progreso: Record<string, number>;
}

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

interface Motivacion {
  racha: { dias: number; diaNuevo: boolean };
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

// Se calcula al instante con la venta recién sumada, igual que la posición: no espera al snapshot.
function calcularMotivacion(ctx: ContextoMotivacion, totalAntes: number, venta: { monto: number; unidades: number; transacciones: number }, yaRegistroHoy: boolean): Motivacion {
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

  // Puntaje ponderado antes y después de la venta (mismas reglas que el orden del ranking mensual).
  const datosScore = (venta: number, u: number, t: number) => calcularScoreRanking({
    ventaReal: venta, metaVenta: ctx.metaMensual, unidades: u, transacciones: t, metaUPT: ctx.metas.upt, metaAVT: ctx.metas.avt,
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
    racha: { dias, diaNuevo },
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

const HITOS_RACHA_PLACA = [3, 5, 7, 10, 15, 20, 25, 30];
const TITULOS_GENERALES = ['¡Vas muy bien!', '¡Excelente venta!', '¡Sigue así, vas con todo!'];

// Elige el logro más importante de esta venta para el título de la placa (siempre en positivo).
function armarPlaca(monto: number, r: Resultado | null, m: Motivacion | null): DatosPlaca {
  const semilla = Date.now();
  let titulo = TITULOS_GENERALES[semilla % TITULOS_GENERALES.length];
  if (m?.recordNuevo) titulo = '¡Nuevo récord personal!';
  else if (m?.nivelNuevo === 120) titulo = '¡Día libre desbloqueado! 🏖️';
  else if (m?.nivelNuevo === 110) titulo = '¡Bono corral desbloqueado! 🎁';
  else if (m?.rescate100Nuevo) titulo = '¡Tu UPT y AVT te llevaron al 100%! 🛟';
  else if (m?.nivelNuevo === 100) titulo = '¡Meta cumplida! 📌';
  else if (r?.subio && r.posicion === 1) titulo = '¡Llegaste al 1º lugar!';
  else if (r?.subio) titulo = `¡Subiste al ${r.posicion}º lugar!`;
  else if (m?.racha.diaNuevo && HITOS_RACHA_PLACA.includes(m.racha.dias)) titulo = `¡Racha de ${m.racha.dias} días!`;
  else if (m?.racha.diaNuevo) titulo = '¡Arrancaste el día!';
  return {
    id: semilla,
    monto,
    titulo,
    frase: m?.rendimiento ?? 'Cada venta construye tu mes. ¡La próxima puede ser la grande!',
    racha: m?.racha.dias ?? 0,
    pct: m?.pct ?? null,
    posicion: r?.posicion ?? null,
  };
}

function MotivacionPostVenta({ m }: { m: Motivacion }) {
  return (
    <ul className="mt-2.5 pt-2.5 border-t border-emerald-200 space-y-1.5 text-[12px] leading-snug text-emerald-950/80">
      <li className="flex gap-2"><span aria-hidden="true">🔥</span><span>{mensajeRacha(m.racha.dias, m.racha.diaNuevo)}</span></li>
      {m.record
        ? <li className="flex gap-2"><span aria-hidden="true">📈</span><span className="font-medium text-emerald-700">{m.record}</span></li>
        : m.rendimiento && <li className="flex gap-2"><span aria-hidden="true">⭐</span><span>{m.rendimiento}</span></li>}
      {m.ritmo && (
        <li className="flex gap-2"><span aria-hidden="true">⏱️</span><span>Para la comisión {m.ritmo.label}: <b className="text-heading tabular-nums">{formatCurrency(m.ritmo.porDia)}</b> por día · {m.ritmo.dias} {m.ritmo.dias === 1 ? 'día' : 'días'}</span></li>
      )}
      {m.tip && (
        <li className="flex gap-2 rounded-lg bg-primary-light border border-primary/15 px-2.5 py-2 -mx-0.5">
          <span aria-hidden="true">💡</span>
          <span><span className="font-medium text-primary">Consejo para subir tu {NOMBRE_INDICADOR[m.tip.indicador]}:</span> {m.tip.texto}</span>
        </li>
      )}
    </ul>
  );
}

interface PosicionMes {
  id: string;
  nombre: string;
  total: number;
  score: number | null;
}

interface Props {
  asesor: Asesor;
  dinamicas?: Dinamica[];
  rankingMes?: PosicionMes[];
  contexto?: ContextoMotivacion;
  onClose: () => void;
}

interface Resultado {
  posicion: number;
  subio: boolean;
  total: number;
  arriba: { nombre: string; gap: number; unidad: 'pts' | '$' } | null;
  abajo: { nombre: string; ventaja: number; unidad: 'pts' | '$' } | null;
}

// Distancia entre dos asesores en la misma unidad que decide el orden: puntos del ranking; si empatan en
// puntos (o no hay meta), en dinero, que es el desempate.
function distancia(alto: { score: number | null; ventaReal: number }, bajo: { score: number | null; ventaReal: number }) {
  if (alto.score !== null && bajo.score !== null && alto.score - bajo.score > 0.05) {
    return { valor: alto.score - bajo.score, unidad: 'pts' as const };
  }
  return { valor: alto.ventaReal - bajo.ventaReal, unidad: '$' as const };
}

function formatDistancia(valor: number, unidad: 'pts' | '$') {
  return unidad === 'pts' ? `${valor.toFixed(1)} pts` : formatCurrency(valor);
}

// Posición con el mismo orden del ranking mensual (puntaje, desempate por dinero): cuántos van delante + 1.
function calcularResultado(ranking: PosicionMes[], asesorId: string, monto: number, scoreNuevo: number | null): Resultado {
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

function AvisoPostVenta({ r, m }: { r: Resultado; m: Motivacion | null }) {
  let mensaje: React.ReactNode;
  if (r.posicion === 1) {
    mensaje = r.abajo && r.abajo.ventaja > 0
      ? <>{r.subio ? '¡Llegaste al 1º lugar!' : '¡Sigues en el 1º lugar!'} Le llevas <b className="tabular-nums">{formatDistancia(r.abajo.ventaja, r.abajo.unidad)}</b> a {r.abajo.nombre}</>
      : <>{r.subio ? '¡Llegaste al 1º lugar!' : '¡Vas en el 1º lugar!'}</>;
  } else if (r.posicion <= 4 && r.arriba) {
    mensaje = <>{r.subio ? `¡Subiste al ${r.posicion}º lugar!` : `Vas en el ${r.posicion}º lugar.`} Ahora estás a <b className="tabular-nums">{formatDistancia(r.arriba.gap, r.arriba.unidad)}</b> de {r.arriba.nombre}</>;
  } else {
    mensaje = <>{r.subio ? `¡Subiste al ${r.posicion}º lugar! ` : ''}Llevas <b className="tabular-nums">{formatCurrency(r.total)}</b> este mes</>;
  }
  return (
    <div role="status" className="animate-slide-up flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[12.5px] leading-snug text-emerald-950 [text-wrap:pretty]">
      <span aria-hidden="true" className="text-base leading-none">{r.subio || r.posicion === 1 ? '🏆' : '✅'}</span>
      <div className="min-w-0">
        <p><span className="font-semibold text-emerald-700">Venta guardada.</span> {mensaje}</p>
        {m && <MotivacionPostVenta m={m} />}
      </div>
    </div>
  );
}

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fechaHoy() {
  return new Date().toLocaleDateString('fr-CA');
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function formatHora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function entryKey(r: Registro) {
  return r.id ?? r.creadoEn;
}

export default function HistorialVentasDiaModal({ asesor, dinamicas, rankingMes, contexto, onClose }: Props) {
  const storeId = useStoreId();
  const mes = mesActual();
  const hoy = fechaHoy();
  const docId = `${mes}_${asesor.id}`;
  const docRef = doc(db, 'tiendas', storeId, 'ventasMes', docId);

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  // Registrar y historial van en vistas separadas: el formulario queda limpio y el historial se abre con su ícono.
  const [vista, setVista] = useState<'registrar' | 'historial'>('registrar');
  // Ventas "nuevas" = registradas después de la última vez que se abrió el historial (por asesor y día, en este
  // dispositivo). Se guarda el creadoEn más reciente visto; localStorage puede fallar (modo privado): sin él,
  // todas cuentan como nuevas hasta abrir el historial.
  const claveVisto = `historial-visto:${storeId}:${asesor.id}:${hoy}`;
  const [vistoHasta, setVistoHasta] = useState<string>(() => {
    try { return localStorage.getItem(claveVisto) ?? ''; } catch { return ''; }
  });
  const [monto, setMonto] = useState('');
  const [unidades, setUnidades] = useState('');
  const [txn, setTxn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [motivacion, setMotivacion] = useState<Motivacion | null>(null);
  const [placa, setPlaca] = useState<DatosPlaca | null>(null);
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const [editEntry, setEditEntry] = useState<Registro | null>(null);
  const [editMonto, setEditMonto] = useState('');
  const [editUds, setEditUds] = useState('');
  const [editTxn, setEditTxn] = useState('');

  const [dinValues, setDinValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    (dinamicas ?? []).forEach((d) => { init[d.id] = ''; });
    return init;
  });
  const [dinSaving, setDinSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const hoyRegs: Registro[] = (data.registros ?? [])
          .filter((r: Registro) => r.fecha === hoy)
          .slice()
          .reverse();
        setRegistros(hoyRegs);
      } else {
        setRegistros([]);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, docId]);

  const handleAgregar = async () => {
    const m = Number(monto.replace(/\D/g, ''));
    const u = parseInt(unidades);
    const t = parseInt(txn);
    if (!m || m <= 0) { setError('Ingresa un monto válido.'); return; }
    if (!u || u <= 0) { setError('Ingresa las unidades (entero).'); return; }
    if (!t || t <= 0) { setError('Ingresa las transacciones (entero).'); return; }
    setSaving(true);
    setError('');
    const registro: Registro = {
      id: crypto.randomUUID(),
      monto: m, unidades: u, transacciones: t,
      fecha: hoy, creadoEn: new Date().toISOString(),
    };
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await updateDoc(docRef, {
          totalVentas: increment(m),
          totalUnidades: increment(u),
          totalTransacciones: increment(t),
          registros: arrayUnion(registro),
        });
      } else {
        await setDoc(docRef, {
          mes, asesorId: asesor.id,
          totalVentas: m, totalUnidades: u, totalTransacciones: t,
          registros: [registro],
        });
      }
      const mot = contexto
        ? calcularMotivacion(contexto, rankingMes?.find((r) => r.id === asesor.id)?.total ?? 0, { monto: m, unidades: u, transacciones: t }, registros.length > 0)
        : null;
      const res = rankingMes?.length ? calcularResultado(rankingMes, asesor.id, m, mot?.score ?? null) : null;
      setResultado(res);
      setMotivacion(mot);
      setPlaca(armarPlaca(m, res, mot));
      setMonto(''); setUnidades(''); setTxn('');
      setShowForm(false);
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Registró venta: ${formatCurrency(m)} · ${t} txn · ${u} uds`);
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    }
    setSaving(false);
  };

  const handleEliminar = async (registro: Registro) => {
    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      const todos: Registro[] = snap.data().registros ?? [];
      const filtered = todos.filter((r) => entryKey(r) !== entryKey(registro));
      await updateDoc(docRef, {
        registros: filtered,
        totalVentas: increment(-registro.monto),
        totalUnidades: increment(-registro.unidades),
        totalTransacciones: increment(-registro.transacciones),
      });
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Eliminó venta de ${formatCurrency(registro.monto)} (${registro.transacciones} txn · ${registro.unidades} uds)`);
    } catch { /* silent */ }
  };

  const nuevas = registros.filter((r) => (r.creadoEn ?? '') > vistoHasta).length;

  const marcarVisto = () => {
    const ultimo = registros.reduce((m, r) => ((r.creadoEn ?? '') > m ? r.creadoEn : m), vistoHasta);
    if (ultimo === vistoHasta) return;
    setVistoHasta(ultimo);
    try { localStorage.setItem(claveVisto, ultimo); } catch { /* sin almacenamiento local */ }
  };

  const cambiarVista = (v: 'registrar' | 'historial') => {
    marcarVisto();
    setVista(v);
    setEditEntry(null);
  };

  const cerrar = () => {
    if (vista === 'historial') marcarVisto();
    onClose();
  };

  const startEdit = (r: Registro) => {
    setEditEntry(r);
    setEditMonto(String(r.monto));
    setEditUds(String(r.unidades));
    setEditTxn(String(r.transacciones));
    setShowForm(false);
  };

  const handleGuardarEdit = async () => {
    if (!editEntry) return;
    const m = parseFloat(editMonto) || 0;
    const u = parseInt(editUds) || 0;
    const t = parseInt(editTxn) || 0;
    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      const todos: Registro[] = snap.data().registros ?? [];
      const idx = todos.findIndex((r) => entryKey(r) === entryKey(editEntry));
      if (idx === -1) return;
      const updated = [...todos];
      updated[idx] = { ...editEntry, monto: m, unidades: u, transacciones: t };
      await updateDoc(docRef, {
        registros: updated,
        totalVentas: increment(m - editEntry.monto),
        totalUnidades: increment(u - editEntry.unidades),
        totalTransacciones: increment(t - editEntry.transacciones),
      });
      crearNotificacion(storeId, asesor.id, `${asesor.nombre} ${asesor.apellido}`,
        `Editó venta: ${formatCurrency(editEntry.monto)} → ${formatCurrency(m)} · ${t} txn · ${u} uds`);
      setEditEntry(null);
    } catch { /* silent */ }
  };

  const handleUpdateDinamica = async (dinamicaId: string) => {
    const val = parseInt(dinValues[dinamicaId] ?? '0', 10);
    if (isNaN(val) || val < 0) return;
    setDinSaving((prev) => ({ ...prev, [dinamicaId]: true }));
    try {
      await updateDoc(doc(db, 'tiendas', storeId, 'dinamicas', dinamicaId), {
        [`progreso.${asesor.id}`]: val,
      });
    } catch { /* silent */ }
    setDinSaving((prev) => ({ ...prev, [dinamicaId]: false }));
  };

  const total = registros.reduce(
    (acc, r) => ({ monto: acc.monto + r.monto, unidades: acc.unidades + r.unidades, transacciones: acc.transacciones + r.transacciones }),
    { monto: 0, unidades: 0, transacciones: 0 }
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="theme-modal bg-surface rounded-2xl w-full max-w-sm flex flex-col max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh] animate-modal">

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {asesor.fotoBase64 ? (
                <Image src={asesor.fotoBase64} alt={asesor.nombre} width={40} height={40} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-gray-400">{asesor.nombre[0]}{asesor.apellido[0]}</span>
              )}
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">{asesor.nombre} {asesor.apellido}</p>
              <p className="text-xs text-gray-400">{vista === 'historial' ? 'Historial de hoy' : 'Registrar venta'} · {hoy}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 -mr-1">
            <button
              type="button"
              onClick={() => cambiarVista(vista === 'historial' ? 'registrar' : 'historial')}
              aria-label={vista === 'historial'
                ? 'Volver a registrar venta'
                : nuevas > 0 ? `Ver historial de hoy (${nuevas} ${nuevas === 1 ? 'venta nueva' : 'ventas nuevas'})` : 'Ver historial de hoy'}
              aria-pressed={vista === 'historial'}
              title="Historial de hoy"
              className={`relative p-2 rounded-lg transition-colors ${vista === 'historial' ? 'bg-gold-light text-gold-text' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l3 2" />
              </svg>
              {nuevas > 0 && vista !== 'historial' && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-gold text-[#00203D] text-[10px] font-bold leading-[1.05rem] text-center tabular-nums" aria-hidden="true">
                  {nuevas}
                </span>
              )}
            </button>
            <button onClick={cerrar} aria-label="Cerrar" className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {vista === 'historial' ? (
          <>
          {/* Total del día */}
          {registros.length > 0 && (
            <div className="mx-6 mb-3 bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500">Total hoy</span>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
                {total.monto > 0 && <span>{formatCurrency(total.monto)}</span>}
                {total.transacciones > 0 && <span className="text-gray-500 font-normal">· {total.transacciones} txn</span>}
                {total.unidades > 0 && <span className="text-gray-500 font-normal">· {total.unidades} uds</span>}
              </div>
            </div>
          )}

          {/* Lista registros */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-3 space-y-2 min-h-0">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              </div>
            ) : registros.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">Aún no hay ventas registradas hoy.</p>
                <button onClick={() => { cambiarVista('registrar'); setShowForm(true); }}
                  className="mt-3 text-sm font-medium text-accent-text hover:underline">
                  Registrar la primera venta
                </button>
              </div>
            ) : registros.map((r) => {
              const key = entryKey(r);
              const isEditing = editEntry && entryKey(editEntry) === key;
              return (
                <div key={key} className="border border-gray-100 rounded-xl px-3 py-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { label: 'Monto', val: editMonto, set: setEditMonto },
                          { label: 'Uds', val: editUds, set: setEditUds },
                          { label: 'Txn', val: editTxn, set: setEditTxn },
                        ] as const).map(({ label, val, set }) => (
                          <div key={label}>
                            <label className="block text-[10px] text-gray-400 mb-0.5">{label}</label>
                            <input type="number" value={val}
                              onChange={(e) => (set as (v: string) => void)(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-accent text-gray-900" min={1} />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditEntry(null)}
                          className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">
                          Cancelar
                        </button>
                        <button onClick={handleGuardarEdit}
                          className="flex-1 text-xs text-on-accent bg-accent rounded-lg py-1.5 hover:bg-accent-hover">
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">{formatHora(r.creadoEn)}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(r.monto)}</span>
                          <span className="text-xs text-gray-500">{r.transacciones} txn</span>
                          <span className="text-xs text-gray-500">{r.unidades} uds</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => startEdit(r)}
                          aria-label="Editar" className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-50 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleEliminar(r)}
                          aria-label="Eliminar" className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-500/10 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            {registros.length > 0 && (
              <div className="px-6 pb-6 pt-3 shrink-0 border-t border-gray-100">
                <button onClick={() => { cambiarVista('registrar'); setShowForm(true); setResultado(null); setMotivacion(null); }}
                  className="w-full px-4 py-2.5 text-sm font-medium text-on-accent bg-accent rounded-xl hover:bg-accent-hover transition-colors">
                  + Registrar venta
                </button>
              </div>
            )}
          </>
        ) : (
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-6 pb-6 space-y-3">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-3 space-y-3">
              <p className="text-xs font-medium text-gray-600">Nueva venta</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monto vendido</label>
                <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-accent text-gray-900"
                  placeholder="Ej. 2500000" min={1} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unidades</label>
                  <input type="number" value={unidades} onChange={(e) => setUnidades(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-accent text-gray-900"
                    placeholder="Ej. 5" min={1} step={1} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Transacciones</label>
                  <input type="number" value={txn} onChange={(e) => setTxn(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-accent text-gray-900"
                    placeholder="Ej. 2" min={1} step={1} />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setError(''); }}
                  className="flex-1 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleAgregar} disabled={saving}
                  className="flex-1 px-3 py-2 text-sm font-medium text-on-accent bg-accent rounded-xl hover:bg-accent-hover disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          ) : (
            <>
            {resultado && <AvisoPostVenta r={resultado} m={motivacion} />}
            <button onClick={() => { setShowForm(true); setEditEntry(null); setResultado(null); setMotivacion(null); }}
              className="w-full px-4 py-2.5 text-sm font-medium text-on-accent bg-accent rounded-xl hover:bg-accent-hover transition-colors">
              + Registrar venta
            </button>
            </>
          )}

          {dinamicas && dinamicas.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500">Dinámicas del día</p>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {dinamicas.map((din) => {
                  const actual = din.progreso?.[asesor.id] ?? 0;
                  const inputVal = dinValues[din.id] ?? '';
                  const displayVal = inputVal !== '' ? Number(inputVal) : actual;
                  const pct = din.meta > 0 ? Math.min(100, (displayVal / din.meta) * 100) : 0;
                  const pctActual = din.meta > 0 ? Math.min(100, (actual / din.meta) * 100) : 0;
                  const textC = pct >= 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-orange-600';
                  const minRestantes = din.horaLimite && din.fecha ? minutosRestantes(din.fecha, din.horaLimite, ahora) : null;
                  const terminado = minRestantes !== null && minRestantes <= 0;
                  return (
                    <div key={din.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gray-700 truncate">
                          {din.nombre}
                          {din.horaLimite && (
                            <span className={`ml-1.5 text-[10px] font-semibold ${terminado ? 'text-gray-400' : 'text-amber-600'}`}>
                              <span aria-hidden="true">⚡</span> {terminado ? 'Terminó' : `hasta ${din.horaLimite}`}
                            </span>
                          )}
                        </span>
                        <span className={`text-xs font-semibold tabular-nums flex-shrink-0 ${textC}`}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="relative w-full bg-gray-100 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full absolute left-0 bg-gray-300`}
                          style={{ width: `${pctActual}%` }}
                        />
                        <div
                          className={`h-1 rounded-full transition-all absolute left-0 ${pct >= 100 ? 'bg-emerald-400' : pct >= 80 ? 'bg-amber-400' : 'bg-orange-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          min="0"
                          value={inputVal}
                          onChange={(e) => setDinValues((prev) => ({ ...prev, [din.id]: e.target.value }))}
                          placeholder={String(actual)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent text-center tabular-nums"
                        />
                        <span className="text-xs text-gray-400 flex-shrink-0">/ {din.meta}</span>
                        <button
                          onClick={() => handleUpdateDinamica(din.id)}
                          disabled={dinSaving[din.id] || inputVal === '' || terminado}
                          className="px-3 py-1.5 text-xs font-medium bg-accent text-on-accent rounded-lg disabled:opacity-40 whitespace-nowrap"
                        >
                          {dinSaving[din.id] ? '...' : 'Guardar'}
                        </button>
                      </div>
                      {actual > 0 && (
                        <p className="text-[10px] text-gray-400 tabular-nums">
                          Acumulado: <span className="font-medium text-gray-600">{actual}</span> / {din.meta}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        )}
      </div>
      {placa && <PlacaReconocimiento key={placa.id} datos={placa} asesor={asesor} onClose={() => setPlaca(null)} />}
    </div>
  );
}
