'use client';

import { useAuth } from '@/context/AuthContext';
import { StoreProvider } from '@/context/StoreContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import LeaderModal from '@/components/LeaderModal';
import PinModal from '@/components/PinModal';
import VentasModal from '@/components/VentasModal';
import HistorialVentasDiaModal from '@/components/HistorialVentasDiaModal';
import NotificacionesPanel from '@/components/NotificacionesPanel';
import HistorialAcumuladoModal from '@/components/HistorialAcumuladoModal';
import TutorialModal from '@/components/TutorialModal';
import { calcularMetas, distribuirIndicador } from '@/lib/calcularMetas';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  cargo: string;
  fotoBase64: string;
  pinHash?: string;
}

interface RegistroDia {
  monto: number;
  unidades: number;
  transacciones: number;
  fecha: string;
}

interface VentaMes {
  asesorId: string;
  totalVentas: number;
  totalUnidades: number;
  totalTransacciones: number;
  registros?: RegistroDia[];
  acumuladoMes?: { monto: number; unidades: number; transacciones: number };
}

interface MetaDia {
  upt: number;
  avt?: number;
  txn: number;
  uds: number;
  monto?: number;
  asesoresIds?: string[];
}

interface Meta {
  montoTotal: number;
  asesores: Record<string, { diasLaborados: number }>;
  metaAVT?: number;
  metaUPT?: number;
  metaTransacciones?: number;
  metaUnidades?: number;
  metasPorDia?: Record<string, MetaDia>;
}

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

const MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = [
  'border-amber-200/80 bg-gradient-to-br from-amber-50 to-yellow-50',
  'border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50',
  'border-orange-200/70 bg-gradient-to-br from-orange-50 to-amber-50/60',
];


function barColor(p: number) {
  if (p >= 120) return 'bg-gradient-to-r from-sky-400 to-cyan-400';
  if (p >= 110) return 'bg-gradient-to-r from-blue-500 to-indigo-500';
  if (p >= 100) return 'bg-gradient-to-r from-emerald-400 to-green-500';
  if (p >= 75)  return 'bg-gradient-to-r from-teal-400 to-emerald-400';
  if (p >= 50)  return 'bg-gradient-to-r from-amber-400 to-yellow-400';
  if (p >= 25)  return 'bg-gradient-to-r from-orange-400 to-amber-400';
  return 'bg-gradient-to-r from-red-400 to-rose-400';
}

function motivacion(p: number) {
  if (p >= 120) return { text: '¡Top absoluto!',   color: 'text-sky-700 bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-200/60' };
  if (p >= 110) return { text: '¡Por encima!',     color: 'text-indigo-700 bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-200/60' };
  if (p >= 100) return { text: '¡Meta cumplida!',  color: 'text-emerald-700 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200/60' };
  if (p >= 75)  return { text: '¡Casi lo logras!', color: 'text-teal-700 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/60' };
  if (p >= 50)  return { text: '¡Buen ritmo!',     color: 'text-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/60' };
  if (p >= 25)  return { text: '¡Sigue adelante!', color: 'text-orange-700 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60' };
  return { text: '¡Empieza hoy!', color: 'text-rose-700 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200/60' };
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-green-600';
  if (pct >= 80)  return 'text-amber-600';
  return 'text-red-500';
}

function indicatorBarFill(pct: number): string {
  if (pct >= 100) return 'bg-gradient-to-r from-emerald-400 to-green-500';
  if (pct >= 80)  return 'bg-gradient-to-r from-amber-400 to-yellow-400';
  return 'bg-gradient-to-r from-rose-400 to-red-400';
}

function IndicatorBar({ label, value, meta, pct, barColor }: {
  label: string; value: string; meta: string | null; pct: number | null; barColor?: string;
}) {
  const textColor = pct === null ? 'text-gray-500' : pct >= 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-rose-600';
  const fill = barColor ?? indicatorBarFill(pct ?? 0);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
        <span className="text-xs text-gray-700 flex-1 truncate">
          {value}{meta && <span className="text-gray-400"> / {meta}</span>}
        </span>
        {pct !== null && (
          <span className={`text-xs font-semibold tabular-nums shrink-0 w-9 text-right ${textColor}`}>
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
      {pct !== null && (
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${fill}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function progresoHoy(vh: { transacciones: number; unidades: number }, mh: MetaDia | undefined): number {
  if (!mh) return 0;
  if (mh.txn > 0) return (vh.transacciones / mh.txn) * 100;
  if (mh.uds > 0) return (vh.unidades / mh.uds) * 100;
  return 0;
}

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [ventasMap, setVentasMap] = useState<Record<string, VentaMes>>({});
  const [meta, setMeta] = useState<Meta | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [showLeaderModal, setShowLeaderModal] = useState(false);
  const [pinAsesor, setPinAsesor] = useState<Asesor | null>(null);
  const [pinMode, setPinMode] = useState<'diario' | 'acumulado'>('diario');
  const [ventasAsesor, setVentasAsesor] = useState<Asesor | null>(null);
  const [acumuladoAsesor, setAcumuladoAsesor] = useState<Asesor | null>(null);
  const [showTutorial, setShowTutorial] = useState<boolean | null>(null);

  const mes = mesActual();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setShowTutorial(!localStorage.getItem('tutorial-visto'));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'tiendas', user.uid, 'asesores'), orderBy('creadoEn', 'asc'));
    return onSnapshot(q, (snap) => {
      setAsesores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asesor)));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'tiendas', user.uid, 'metas', mes)).then((snap) => {
      if (snap.exists()) setMeta(snap.data() as Meta);
      setDataLoading(false);
    });
  }, [user, mes]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, 'tiendas', user.uid, 'ventasMes'),
      (snap) => {
        const map: Record<string, VentaMes> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as VentaMes & { mes: string };
          if (data.mes === mes) map[data.asesorId] = data;
        });
        setVentasMap(map);
      },
      (err) => console.error('ventasMes:', err)
    );
  }, [user, mes]);

  if (authLoading || !user) return null;

  const asesorIds = asesores.map((a) => a.id);

  const metasMap = meta && asesores.length > 0
    ? calcularMetas(meta.montoTotal, asesorIds, meta.asesores)
    : {};

  const txnPorAsesor = meta?.metaTransacciones && meta.asesores
    ? distribuirIndicador(meta.metaTransacciones, asesorIds, meta.asesores)
    : {};
  const udsPorAsesor = meta?.metaUnidades && meta.asesores
    ? distribuirIndicador(meta.metaUnidades, asesorIds, meta.asesores)
    : {};

  const todayDow = String(new Date().getDay());
  const metaHoy = meta?.metasPorDia?.[todayDow];

  // Asesores trabajando hoy: solo los seleccionados por el líder si están configurados
  const asesoresHoy = metaHoy?.asesoresIds?.length
    ? asesores.filter((a) => metaHoy!.asesoresIds!.includes(a.id))
    : [];

  const hoy = fechaHoy();
  const ventaHoyMap: Record<string, { monto: number; unidades: number; transacciones: number }> = {};
  asesores.forEach((a) => {
    const vm = ventasMap[a.id];
    const reg = vm?.registros?.filter((r) => r.fecha === hoy) ?? [];
    ventaHoyMap[a.id] = reg.reduce(
      (acc, r) => ({ monto: acc.monto + r.monto, unidades: acc.unidades + r.unidades, transacciones: acc.transacciones + r.transacciones }),
      { monto: 0, unidades: 0, transacciones: 0 }
    );
  });

  // Ranking de hoy: solo cuando el líder seleccionó asesores para hoy
  const showDailySection = asesoresHoy.length > 0;
  const dailyRanking = showDailySection
    ? [...asesoresHoy].sort((a, b) => progresoHoy(ventaHoyMap[b.id], metaHoy) - progresoHoy(ventaHoyMap[a.id], metaHoy))
    : [];

  // Ranking mensual: TODOS los asesores, ordenados por total real (incluye acumuladoMes)
  const ranking = [...asesores].sort((a, b) => {
    const vmA = ventasMap[a.id];
    const vmB = ventasMap[b.id];
    const totalA = (vmA?.totalVentas ?? 0) + (vmA?.acumuladoMes?.monto ?? 0);
    const totalB = (vmB?.totalVentas ?? 0) + (vmB?.acumuladoMes?.monto ?? 0);
    return totalB - totalA;
  });

  const mesNombre = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  return (
    <StoreProvider storeId={user.uid}>
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/60">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-[0_1px_12px_rgba(0,0,0,0.04)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">Ranking Ventas</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {user.photoURL && (
              <Image src={user.photoURL} alt={user.displayName ?? ''} width={28} height={28} className="rounded-full" />
            )}
            <span className="text-sm text-gray-600 hidden sm:block">{user.displayName}</span>
          </div>
          <NotificacionesPanel />
          <button onClick={() => setShowLeaderModal(true)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Líder
          </button>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">Salir</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight capitalize">{mesNombre}</h1>
          {meta ? (
            <p className="text-sm text-gray-400 mt-0.5">Meta total: {formatCurrency(meta.montoTotal)} · {asesores.length} asesores</p>
          ) : (
            <p className="text-sm text-gray-400 mt-0.5">No hay meta configurada para este mes.</p>
          )}
        </div>

        {dataLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : asesores.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">No hay asesores registrados aún.</p>
        ) : (
          <>
            {/* ── RANKING DE HOY: solo asesores trabajando hoy ── */}
            {showDailySection && (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30 animate-pulse" />
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Ranking de hoy</h2>
                  </div>
                  <p className="text-sm text-gray-400 capitalize">{hoy} · {dailyRanking.length} trabajando hoy</p>
                </div>
                <div className="space-y-3">
                  {dailyRanking.map((asesor, index) => {
                    const vh    = ventaHoyMap[asesor.id] ?? { monto: 0, unidades: 0, transacciones: 0 };
                    const uptH  = vh.transacciones > 0 ? vh.unidades / vh.transacciones : null;
                    const avtH  = vh.transacciones > 0 ? vh.monto    / vh.transacciones : null;
                    const pctUPTH = uptH !== null && metaHoy?.upt && metaHoy.upt > 0 ? (uptH / metaHoy.upt) * 100 : null;
                    const pctAVTH = avtH !== null && metaHoy?.avt && metaHoy.avt > 0 ? (avtH / metaHoy.avt) * 100 : null;
                    const isTop3 = index < 3;

                    // Metas individuales: total del día dividido entre los asesores que trabajan hoy
                    const N = asesoresHoy.length;
                    const txnMeta   = metaHoy && metaHoy.txn   > 0 ? metaHoy.txn   / N : 0;
                    const udsMeta   = metaHoy && metaHoy.uds   > 0 ? metaHoy.uds   / N : 0;
                    const montoMeta = metaHoy?.monto && metaHoy.monto > 0 ? metaHoy.monto / N : 0;

                    const pctTxn   = txnMeta   > 0 ? (vh.transacciones / txnMeta)   * 100 : null;
                    const pctUds   = udsMeta   > 0 ? (vh.unidades      / udsMeta)   * 100 : null;
                    const pctMonto = montoMeta > 0 ? (vh.monto         / montoMeta) * 100 : null;

                    // Barra combinada: promedio de las métricas con meta configurada
                    const available = [pctTxn, pctUds, pctMonto].filter((p): p is number => p !== null);
                    const pctCombined = available.length > 0
                      ? available.reduce((a, b) => a + b, 0) / available.length
                      : 0;

                    const badgeColor = pctCombined >= 100 ? 'text-emerald-700 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200/60' :
                                       pctCombined >= 75  ? 'text-indigo-700 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/60'  :
                                       pctCombined >= 50  ? 'text-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/60' :
                                                            'text-orange-700 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200/60';
                    const barFill    = pctCombined >= 100 ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
                                       pctCombined >= 75  ? 'bg-gradient-to-r from-blue-400 to-indigo-500'  :
                                       pctCombined >= 50  ? 'bg-gradient-to-r from-amber-400 to-yellow-400' : 'bg-gradient-to-r from-orange-400 to-red-400';

                    return (
                      <button
                        key={asesor.id}
                        onClick={() => { setPinMode('diario'); setPinAsesor(asesor); }}
                        className={`w-full text-left border rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] animate-slide-up ${isTop3 ? RANK_COLORS[index] : 'border-gray-100 bg-white shadow-sm'}`}
                        style={{ animationDelay: `${index * 60}ms` }}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-shrink-0 w-8 text-center">
                            {isTop3
                              ? <span className="text-2xl">{MEDALS[index]}</span>
                              : <span className="text-sm font-semibold text-gray-400">#{index + 1}</span>}
                          </div>
                          <div className="w-11 h-11 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {asesor.fotoBase64
                              ? <Image src={asesor.fotoBase64} alt={asesor.nombre} width={44} height={44} className="w-full h-full object-cover" />
                              : <span className="text-base font-semibold text-gray-400">{asesor.nombre[0]}{asesor.apellido[0]}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{asesor.nombre} {asesor.apellido}</p>
                            <p className="text-xs text-gray-400 truncate">{asesor.cargo}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${badgeColor}`}>
                            {pctCombined.toFixed(0)}%
                          </span>
                        </div>

                        {/* Barra combinada */}
                        {available.length > 0 && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">General</span>
                              <span className={`font-bold text-xs ${badgeColor.split(' ')[0]}`}>{pctCombined.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full transition-all duration-500 ${barFill}`}
                                style={{ width: `${Math.min(100, pctCombined)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Indicadores individuales */}
                        {(pctTxn !== null || pctUds !== null || pctMonto !== null || uptH !== null || avtH !== null) && (
                          <div className="rounded-xl border border-gray-100 bg-white/70 px-3 py-2.5 space-y-2.5">
                            {pctTxn !== null && (
                              <IndicatorBar
                                label="Txn"
                                value={String(vh.transacciones)}
                                meta={String(Math.round(txnMeta))}
                                pct={pctTxn}
                                barColor="bg-gradient-to-r from-violet-400 to-purple-500"
                              />
                            )}
                            {pctUds !== null && (
                              <IndicatorBar
                                label="Uds"
                                value={String(vh.unidades)}
                                meta={String(Math.round(udsMeta))}
                                pct={pctUds}
                                barColor="bg-gradient-to-r from-orange-400 to-amber-500"
                              />
                            )}
                            {pctMonto !== null && (
                              <IndicatorBar
                                label="Monto"
                                value={formatCurrency(vh.monto)}
                                meta={formatCurrency(montoMeta)}
                                pct={pctMonto}
                                barColor="bg-gradient-to-r from-emerald-400 to-green-500"
                              />
                            )}
                            {uptH !== null && (
                              <IndicatorBar
                                label="UPT"
                                value={uptH.toFixed(2)}
                                meta={metaHoy?.upt && metaHoy.upt > 0 ? metaHoy.upt.toFixed(2) : null}
                                pct={pctUPTH}
                                barColor="bg-gradient-to-r from-teal-400 to-cyan-500"
                              />
                            )}
                            {avtH !== null && (
                              <IndicatorBar
                                label="AVT"
                                value={formatCurrency(avtH)}
                                meta={metaHoy?.avt && metaHoy.avt > 0 ? formatCurrency(metaHoy.avt) : null}
                                pct={pctAVTH}
                                barColor="bg-gradient-to-r from-blue-400 to-indigo-500"
                              />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── RANKING MENSUAL: todos los asesores ── */}
            <div className={showDailySection ? 'mt-10' : ''}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Ranking mensual</h2>
                <p className="text-sm text-gray-400 mt-0.5 capitalize">{mesNombre} · {asesores.length} asesores</p>
              </div>
              <div className="space-y-3">
                {ranking.map((asesor, index) => {
                  const vm = ventasMap[asesor.id];
                  const totalVentas        = (vm?.totalVentas        ?? 0) + (vm?.acumuladoMes?.monto         ?? 0);
                  const totalUnidades      = (vm?.totalUnidades      ?? 0) + (vm?.acumuladoMes?.unidades      ?? 0);
                  const totalTransacciones = (vm?.totalTransacciones ?? 0) + (vm?.acumuladoMes?.transacciones ?? 0);

                  const mc          = metasMap[asesor.id];
                  const metaMensual = mc?.metaMensual ?? 0;
                  const progreso    = metaMensual > 0 ? (totalVentas / metaMensual) * 100 : 0;
                  const faltaMes    = Math.max(0, metaMensual - totalVentas);

                  const avt = totalTransacciones > 0 ? totalVentas / totalTransacciones : null;
                  const pctAVT    = avt !== null && meta?.metaAVT ? (avt / meta.metaAVT) * 100 : null;

                  const upt        = totalTransacciones > 0 ? totalUnidades / totalTransacciones : null;
                  const metaUPTRef = metaHoy?.upt ?? meta?.metaUPT ?? null;
                  const pctUPT     = upt !== null && metaUPTRef ? (upt / metaUPTRef) * 100 : null;

                  const metaTxnAsesor: number | null = (() => {
                    const v = txnPorAsesor[asesor.id];
                    if (v !== undefined && v > 0) return v;
                    return meta?.metaTransacciones && asesorIds.length > 0 ? meta.metaTransacciones / asesorIds.length : null;
                  })();
                  const pctTxn = metaTxnAsesor !== null ? (totalTransacciones / metaTxnAsesor) * 100 : null;

                  const metaUdsAsesor: number | null = (() => {
                    const v = udsPorAsesor[asesor.id];
                    if (v !== undefined && v > 0) return v;
                    return meta?.metaUnidades && asesorIds.length > 0 ? meta.metaUnidades / asesorIds.length : null;
                  })();
                  const pctUds = metaUdsAsesor !== null ? (totalUnidades / metaUdsAsesor) * 100 : null;

                  const showIndicators = metaMensual > 0 || avt !== null || upt !== null || pctTxn !== null || pctUds !== null;
                  const isTop3 = index < 3;
                  const { text: mot, color: motColor } = motivacion(progreso);

                  const ventaHoy   = ventaHoyMap[asesor.id] ?? { monto: 0, unidades: 0, transacciones: 0 };
                  const uptHoy     = ventaHoy.transacciones > 0 ? ventaHoy.unidades / ventaHoy.transacciones : null;
                  const hasHoyData = ventaHoy.monto > 0;

                  return (
                    <button
                      key={asesor.id}
                      onClick={() => { setPinMode('acumulado'); setPinAsesor(asesor); }}
                      className={`w-full text-left border rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] animate-slide-up ${
                        isTop3 ? RANK_COLORS[index] : 'border-gray-100 bg-white shadow-sm'
                      }`}
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-shrink-0 w-8 text-center">
                          {isTop3
                            ? <span className="text-2xl">{MEDALS[index]}</span>
                            : <span className="text-sm font-semibold text-gray-400">#{index + 1}</span>}
                        </div>
                        <div className="w-11 h-11 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {asesor.fotoBase64
                            ? <Image src={asesor.fotoBase64} alt={asesor.nombre} width={44} height={44} className="w-full h-full object-cover" />
                            : <span className="text-base font-semibold text-gray-400">{asesor.nombre[0]}{asesor.apellido[0]}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{asesor.nombre} {asesor.apellido}</p>
                          <p className="text-xs text-gray-400 truncate">{asesor.cargo}</p>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${motColor}`}>
                          {mot}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Meta mensual</p>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-500">Progreso mensual</span>
                          <span className={`font-semibold ${
                            progreso >= 120 ? 'text-sky-600' :
                            progreso >= 110 ? 'text-blue-700' :
                            progreso >= 100 ? 'text-green-600' : 'text-gray-900'
                          }`}>{progreso.toFixed(1)}%</span>
                        </div>
                        <div className="relative w-full bg-gray-100 rounded-full h-2.5 overflow-visible">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-700 ease-out ${barColor(progreso)}`}
                            style={{ width: `${Math.min(120, progreso) / 120 * 100}%` }}
                          />
                          {([
                            { pct: 100, achieved: progreso >= 100, dot: 'bg-emerald-500', glow: 'shadow-[0_0_8px_rgba(52,211,153,0.7)]' },
                            { pct: 110, achieved: progreso >= 110, dot: 'bg-indigo-500',  glow: 'shadow-[0_0_8px_rgba(99,102,241,0.7)]' },
                            { pct: 120, achieved: progreso >= 120, dot: 'bg-sky-400',     glow: 'shadow-[0_0_8px_rgba(56,189,248,0.7)]' },
                          ] as const).map(({ pct, achieved, dot, glow }) => (
                            <span
                              key={pct}
                              className={`absolute top-1/2 w-3 h-3 rounded-full border-2 border-white transition-all duration-500 ${achieved ? `${dot} ${glow}` : 'bg-gray-300'}`}
                              style={{ left: `${(pct / 120) * 100}%`, transform: 'translate(-50%, -50%)' }}
                            />
                          ))}
                        </div>
                        <div className="relative w-full mt-1 h-3.5">
                          {([
                            { pct: 100, label: '100%', color: 'text-green-600' },
                            { pct: 110, label: '110%', color: 'text-blue-700'  },
                            { pct: 120, label: '120%', color: 'text-sky-600'   },
                          ] as const).map(({ pct, label, color }) => (
                            <span
                              key={pct}
                              className={`absolute text-[10px] font-medium leading-none ${progreso >= pct ? color : 'text-gray-400'}`}
                              style={{ left: `${(pct / 120) * 100}%`, transform: 'translateX(-50%)' }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                        {progreso >= 100 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-400 mb-1.5">Beneficios alcanzados</p>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 font-semibold border border-emerald-200/60">
                                📌 Pin
                              </span>
                              {progreso >= 110 && (
                                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700 font-semibold border border-indigo-200/60">
                                  🎁 Bono corral
                                </span>
                              )}
                              {progreso >= 120 && (
                                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-sky-100 to-cyan-100 text-sky-700 font-semibold border border-sky-200/60">
                                  🏖️ Día libre
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/70 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-400">Importe</p>
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(totalVentas)}</p>
                        </div>
                        <div className={`rounded-xl px-3 py-2 ${progreso >= 100 ? 'bg-green-100' : 'bg-white/70'}`}>
                          <p className="text-xs text-gray-400">{progreso >= 100 ? 'Excedente' : 'Falta para meta'}</p>
                          <p className={`text-sm font-bold ${progreso >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                            {formatCurrency(progreso >= 100 ? totalVentas - metaMensual : faltaMes)}
                          </p>
                        </div>
                      </div>

                      {vm?.acumuladoMes && (vm.acumuladoMes.monto > 0 || vm.acumuladoMes.transacciones > 0 || vm.acumuladoMes.unidades > 0) && (
                        <div className="mt-2 flex items-center justify-between bg-indigo-50/60 border border-indigo-100/60 rounded-xl px-3 py-2">
                          <span className="text-xs text-indigo-500/80">Acumulado ingresado</span>
                          <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                            {vm.acumuladoMes.monto > 0 && <span>{formatCurrency(vm.acumuladoMes.monto)}</span>}
                            {vm.acumuladoMes.transacciones > 0 && <span className="text-gray-400">· {vm.acumuladoMes.transacciones} txn</span>}
                            {vm.acumuladoMes.unidades > 0 && <span className="text-gray-400">· {vm.acumuladoMes.unidades} uds</span>}
                          </div>
                        </div>
                      )}

                      {showIndicators && (
                        <div className="mt-3 rounded-xl border border-gray-100 bg-white/70 px-3 py-2.5 space-y-2.5">
                          {metaMensual > 0 && (
                            <IndicatorBar
                              label="Monto"
                              value={formatCurrency(totalVentas)}
                              meta={formatCurrency(metaMensual)}
                              pct={progreso}
                              barColor="bg-gradient-to-r from-emerald-400 to-green-500"
                            />
                          )}
                          {avt !== null && (
                            <IndicatorBar
                              label="AVT"
                              value={formatCurrency(avt)}
                              meta={meta?.metaAVT ? formatCurrency(meta.metaAVT) : null}
                              pct={pctAVT}
                              barColor="bg-gradient-to-r from-blue-400 to-indigo-500"
                            />
                          )}
                          {upt !== null && (
                            <IndicatorBar
                              label="UPT"
                              value={upt.toFixed(2)}
                              meta={metaUPTRef ? metaUPTRef.toFixed(2) : null}
                              pct={pctUPT}
                              barColor="bg-gradient-to-r from-teal-400 to-cyan-500"
                            />
                          )}
                          {pctTxn !== null && (
                            <IndicatorBar
                              label="Transacc."
                              value={String(totalTransacciones)}
                              meta={String(Math.round(metaTxnAsesor!))}
                              pct={pctTxn}
                              barColor="bg-gradient-to-r from-violet-400 to-purple-500"
                            />
                          )}
                          {(totalUnidades > 0 || metaUdsAsesor !== null) && (
                            <IndicatorBar
                              label="Unidades"
                              value={String(totalUnidades)}
                              meta={metaUdsAsesor !== null ? String(Math.round(metaUdsAsesor)) : null}
                              pct={pctUds}
                              barColor="bg-gradient-to-r from-orange-400 to-amber-500"
                            />
                          )}
                        </div>
                      )}

                      {/* Sección Hoy: solo cuando no hay ranking de hoy separado */}
                      {!showDailySection && hasHoyData && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-2.5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hoy</p>
                            <p className="text-[11px] text-gray-400">{hoy}</p>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-white/70 rounded-xl p-2 text-center">
                              <p className="text-[10px] text-gray-400 mb-0.5">Txn</p>
                              <p className="text-sm font-bold leading-tight text-gray-900">
                                {ventaHoy.transacciones}
                              </p>
                            </div>
                            <div className="bg-white/70 rounded-xl p-2 text-center">
                              <p className="text-[10px] text-gray-400 mb-0.5">UPT</p>
                              <p className="text-sm font-bold leading-tight text-gray-900">
                                {uptHoy !== null ? uptHoy.toFixed(1) : '—'}
                              </p>
                            </div>
                            <div className="bg-white/70 rounded-xl p-2 text-center">
                              <p className="text-[10px] text-gray-400 mb-0.5">Uds</p>
                              <p className="text-sm font-bold leading-tight text-gray-900">
                                {ventaHoy.unidades}
                              </p>
                            </div>
                            <div className="bg-white/70 rounded-xl p-2 text-center">
                              <p className="text-[10px] text-gray-400 mb-0.5">Importe</p>
                              <p className="text-sm font-bold text-gray-900 leading-tight">
                                {ventaHoy.monto > 0 ? formatCurrency(ventaHoy.monto) : '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {showTutorial === true && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showLeaderModal && <LeaderModal onClose={() => setShowLeaderModal(false)} />}

      {pinAsesor && (
        <PinModal
          asesor={pinAsesor}
          onSuccess={() => {
            if (pinMode === 'diario') {
              setVentasAsesor(pinAsesor);
            } else {
              setAcumuladoAsesor(pinAsesor);
            }
            setPinAsesor(null);
          }}
          onClose={() => setPinAsesor(null)}
        />
      )}

      {ventasAsesor && (
        <HistorialVentasDiaModal
          asesor={ventasAsesor}
          onClose={() => setVentasAsesor(null)}
        />
      )}

      {acumuladoAsesor && (
        <HistorialAcumuladoModal
          asesor={acumuladoAsesor}
          onClose={() => setAcumuladoAsesor(null)}
        />
      )}
    </main>
    </StoreProvider>
  );
}
