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
}

interface MetaDia {
  upt: number;
  txn: number;
  uds: number;
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
  'border-amber-200 bg-amber-50',
  'border-gray-200 bg-gray-50',
  'border-orange-200 bg-orange-50',
];


function barColor(p: number) {
  if (p >= 120) return 'bg-sky-400';
  if (p >= 110) return 'bg-blue-600';
  if (p >= 100) return 'bg-green-500';
  if (p >= 75)  return 'bg-teal-400';
  if (p >= 50)  return 'bg-amber-500';
  if (p >= 25)  return 'bg-orange-500';
  return 'bg-red-500';
}

function motivacion(p: number) {
  if (p >= 120) return { text: '¡Top absoluto!', color: 'text-sky-600 bg-sky-50' };
  if (p >= 110) return { text: '¡Por encima!',   color: 'text-blue-700 bg-blue-50' };
  if (p >= 100) return { text: '¡Meta cumplida!', color: 'text-green-600 bg-green-50' };
  if (p >= 75)  return { text: '¡Casi lo logras!', color: 'text-teal-600 bg-teal-50' };
  if (p >= 50)  return { text: '¡Buen ritmo!', color: 'text-amber-600 bg-amber-50' };
  if (p >= 25)  return { text: '¡Sigue adelante!', color: 'text-orange-600 bg-orange-50' };
  return { text: '¡Empieza hoy!', color: 'text-red-600 bg-red-50' };
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-green-600';
  if (pct >= 80)  return 'text-amber-600';
  return 'text-red-500';
}

function progresoHoy(vh: { transacciones: number; unidades: number }, mh: MetaDia | undefined): number {
  if (!mh) return 0;
  if (mh.txn > 0) return (vh.transacciones / mh.txn) * 100;
  if (mh.uds > 0) return (vh.unidades / mh.uds) * 100;
  return 0;
}

const IVA = 1.19;

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [ventasMap, setVentasMap] = useState<Record<string, VentaMes>>({});
  const [meta, setMeta] = useState<Meta | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [showLeaderModal, setShowLeaderModal] = useState(false);
  const [pinAsesor, setPinAsesor] = useState<Asesor | null>(null);
  const [ventasAsesor, setVentasAsesor] = useState<Asesor | null>(null);
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
  const dailyRanking = metaHoy
    ? [...asesores].sort((a, b) => progresoHoy(ventaHoyMap[b.id], metaHoy) - progresoHoy(ventaHoyMap[a.id], metaHoy))
    : [];

  const ranking = [...asesores].sort((a, b) => (ventasMap[b.id]?.totalVentas ?? 0) - (ventasMap[a.id]?.totalVentas ?? 0));

  const mesNombre = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  return (
    <StoreProvider storeId={user.uid}>
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
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
          <div className="space-y-3">
            {ranking.map((asesor, index) => {
              const vm = ventasMap[asesor.id];
              const totalVentas        = vm?.totalVentas        ?? 0;
              const totalUnidades      = vm?.totalUnidades      ?? 0;
              const totalTransacciones = vm?.totalTransacciones ?? 0;

              const mc           = metasMap[asesor.id];
              const metaMensual  = mc?.metaMensual ?? 0;
              const diasLab      = mc?.diasLaborados ?? 0;
              const progreso     = metaMensual > 0 ? (totalVentas / metaMensual) * 100 : 0;
              const faltaMes     = Math.max(0, metaMensual - totalVentas);

              // 1. PPTO sin IVA
              const pptoSinIva = metaMensual > 0 ? metaMensual / IVA : null;
              const realSinIva = totalVentas / IVA;
              const pctPpto    = pptoSinIva !== null && pptoSinIva > 0 ? (realSinIva / pptoSinIva) * 100 : null;

              // 2. AVT
              const avt       = totalTransacciones > 0 ? totalVentas / totalTransacciones : null;
              const avtSinIva = avt !== null ? avt / IVA : null;
              const pctAVT    = avt !== null && meta?.metaAVT ? (avt / meta.metaAVT) * 100 : null;

              // 3. UPT — usa meta del día actual si existe
              const upt       = totalTransacciones > 0 ? totalUnidades / totalTransacciones : null;
              const metaUPTHoy = metaHoy?.upt ?? meta?.metaUPT ?? null;
              const pctUPT    = upt !== null && metaUPTHoy ? (upt / metaUPTHoy) * 100 : null;

              // 4. Transacciones — meta distribuida por asesor
              const metaTxnAsesor = txnPorAsesor[asesor.id] ?? null;
              const pctTxn        = metaTxnAsesor !== null && metaTxnAsesor > 0 ? (totalTransacciones / metaTxnAsesor) * 100 : null;
              const metaDiariaTxn = metaHoy?.txn
                ? metaHoy.txn
                : metaTxnAsesor !== null && diasLab > 0 ? metaTxnAsesor / diasLab : null;

              // 5. Unidades — meta distribuida por asesor
              const metaUdsAsesor = udsPorAsesor[asesor.id] ?? null;
              const pctUds        = metaUdsAsesor !== null && metaUdsAsesor > 0 ? (totalUnidades / metaUdsAsesor) * 100 : null;
              const metaDiariaUds = metaHoy?.uds
                ? metaHoy.uds
                : metaUdsAsesor !== null && diasLab > 0 ? metaUdsAsesor / diasLab : null;

              const showIndicators = pctPpto !== null || avt !== null || pctTxn !== null || meta?.metaUnidades;

              const ventaHoy = ventaHoyMap[asesor.id] ?? { monto: 0, unidades: 0, transacciones: 0 };
              const uptHoy = ventaHoy.transacciones > 0 ? ventaHoy.unidades / ventaHoy.transacciones : null;
              const hasHoyData = !!metaHoy || ventaHoy.monto > 0;

              const isTop3 = index < 3;
              const { text: mot, color: motColor } = motivacion(progreso);

              return (
                <button
                  key={asesor.id}
                  onClick={() => setPinAsesor(asesor)}
                  className={`w-full text-left border rounded-2xl p-5 transition-all hover:shadow-md active:scale-[0.99] ${
                    isTop3 ? RANK_COLORS[index] : 'border-gray-100 bg-white'
                  }`}
                >
                  {/* Header: posición, avatar, nombre, badge */}
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

                  {/* ── META MENSUAL ── */}
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Meta mensual</p>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  {/* Barra de progreso */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500">Progreso mensual</span>
                      <span className={`font-semibold ${
                        progreso >= 120 ? 'text-sky-600' :
                        progreso >= 110 ? 'text-blue-700' :
                        progreso >= 100 ? 'text-green-600' : 'text-gray-900'
                      }`}>{progreso.toFixed(1)}%</span>
                    </div>
                    {/* Barra con marcadores en 100%, 110%, 120% */}
                    <div className="relative w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${barColor(progreso)}`}
                        style={{ width: `${Math.min(120, progreso) / 120 * 100}%` }}
                      />
                      {([
                        { pct: 100, achieved: progreso >= 100, dot: 'bg-green-500' },
                        { pct: 110, achieved: progreso >= 110, dot: 'bg-blue-600'  },
                        { pct: 120, achieved: progreso >= 120, dot: 'bg-sky-400'   },
                      ] as const).map(({ pct, achieved, dot }) => (
                        <span
                          key={pct}
                          className={`absolute top-1/2 w-3 h-3 rounded-full border-2 border-white transition-all duration-300 ${achieved ? dot : 'bg-gray-300'}`}
                          style={{ left: `${(pct / 120) * 100}%`, transform: 'translate(-50%, -50%)' }}
                        />
                      ))}
                    </div>
                    {/* Etiquetas debajo de cada marcador */}
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
                    {/* Premios ganados */}
                    {progreso >= 100 && (
                      <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1.5">Beneficios alcanzados</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          📌 Pin
                        </span>
                        {progreso >= 110 && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            🎁 Bono corral
                          </span>
                        )}
                        {progreso >= 120 && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">
                            🏖️ Día libre
                          </span>
                        )}
                      </div>
                      </div>
                    )}
                  </div>

                  {/* Importe y falta */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/70 rounded-xl px-3 py-2">
                      <p className="text-xs text-gray-400">Importe</p>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(totalVentas)}</p>
                    </div>
                    <div className={`rounded-xl px-3 py-2 ${faltaMes === 0 ? 'bg-green-100' : 'bg-white/70'}`}>
                      <p className="text-xs text-gray-400">Falta para meta</p>
                      <p className={`text-sm font-bold ${faltaMes === 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {faltaMes === 0 ? '¡Cumplida!' : formatCurrency(faltaMes)}
                      </p>
                    </div>
                  </div>

                  {/* Indicadores de gestión */}
                  {showIndicators && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-gray-100 divide-y divide-gray-50">

                      {/* PPTO sin IVA */}
                      {pctPpto !== null && (
                        <div className={`flex items-center px-3 py-2 gap-3 ${
                          pctPpto >= 100 ? 'bg-green-50' : pctPpto < 80 ? 'bg-red-50' : 'bg-white/70'
                        }`}>
                          <span className="text-xs text-gray-400 w-[4.5rem] shrink-0">PPTO s/IVA</span>
                          <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">
                            {formatCurrency(realSinIva)}{' '}
                            <span className="text-gray-400">/ {formatCurrency(pptoSinIva!)}</span>
                          </span>
                          <span className={`text-xs font-semibold tabular-nums shrink-0 ${
                            pctPpto >= 100 ? 'text-green-700' : pctPpto < 80 ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {pctPpto.toFixed(0)}%
                          </span>
                        </div>
                      )}

                      {/* AVT */}
                      {avt !== null && (
                        <div className="flex items-center px-3 py-2 gap-3 bg-white/70">
                          <span className="text-xs text-gray-400 w-[4.5rem] shrink-0">AVT</span>
                          <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">
                            {formatCurrency(avt)}{' '}
                            <span className="text-gray-400">s/IVA {formatCurrency(avtSinIva!)}</span>
                          </span>
                          {pctAVT !== null && (
                            <span className={`text-xs font-semibold tabular-nums shrink-0 ${pctColor(pctAVT)}`}>
                              {pctAVT.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )}

                      {/* UPT */}
                      {upt !== null && (
                        <div className="flex items-center px-3 py-2 gap-3 bg-white/70">
                          <span className="text-xs text-gray-400 w-[4.5rem] shrink-0">UPT</span>
                          <span className="text-xs text-gray-700 flex-1 min-w-0 font-medium">
                            {upt.toFixed(2)}
                            {metaUPTHoy && (
                              <span className="text-gray-400 font-normal"> / {metaUPTHoy.toFixed(2)}</span>
                            )}
                          </span>
                          {pctUPT !== null && (
                            <span className={`text-xs font-semibold tabular-nums shrink-0 ${pctColor(pctUPT)}`}>
                              {pctUPT.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )}

                      {/* Transacciones */}
                      {pctTxn !== null && (
                        <div className="flex items-center px-3 py-2 gap-3 bg-white/70">
                          <span className="text-xs text-gray-400 w-[4.5rem] shrink-0">Transacc.</span>
                          <span className="text-xs text-gray-600 flex-1 min-w-0">
                            {totalTransacciones}
                            <span className="text-gray-400">
                              {' '}/ {Math.round(metaTxnAsesor!)}
                            </span>
                          </span>
                          <span className={`text-xs font-semibold tabular-nums shrink-0 ${pctColor(pctTxn)}`}>
                            {pctTxn.toFixed(0)}%
                          </span>
                        </div>
                      )}

                      {/* Unidades */}
                      {(totalUnidades > 0 || metaUdsAsesor !== null) && (
                        <div className="flex items-center px-3 py-2 gap-3 bg-white/70">
                          <span className="text-xs text-gray-400 w-[4.5rem] shrink-0">Unidades</span>
                          <span className="text-xs text-gray-600 flex-1 min-w-0">
                            {totalUnidades}
                            {metaUdsAsesor !== null && (
                              <span className="text-gray-400">
                                {' '}/ {Math.round(metaUdsAsesor)}
                              </span>
                            )}
                          </span>
                          {pctUds !== null && (
                            <span className={`text-xs font-semibold tabular-nums shrink-0 ${pctColor(pctUds)}`}>
                              {pctUds.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── META HOY ── */}
                  {hasHoyData && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hoy</p>
                        <p className="text-[11px] text-gray-400">{hoy}</p>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {/* Txn hoy */}
                        <div className="bg-white/70 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Txn</p>
                          <p className={`text-sm font-bold leading-tight ${
                            metaHoy?.txn && ventaHoy.transacciones >= metaHoy.txn ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {ventaHoy.transacciones}
                          </p>
                          {metaHoy?.txn && (
                            <p className="text-[10px] text-gray-400">/{metaHoy.txn}</p>
                          )}
                        </div>
                        {/* UPT hoy */}
                        <div className="bg-white/70 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">UPT</p>
                          <p className={`text-sm font-bold leading-tight ${
                            metaHoy?.upt && uptHoy !== null && uptHoy >= metaHoy.upt ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {uptHoy !== null ? uptHoy.toFixed(1) : '—'}
                          </p>
                          {metaHoy?.upt && (
                            <p className="text-[10px] text-gray-400">/{metaHoy.upt}</p>
                          )}
                        </div>
                        {/* Unidades hoy */}
                        <div className="bg-white/70 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Uds</p>
                          <p className={`text-sm font-bold leading-tight ${
                            metaHoy?.uds && ventaHoy.unidades >= metaHoy.uds ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {ventaHoy.unidades}
                          </p>
                          {metaHoy?.uds && (
                            <p className="text-[10px] text-gray-400">/{metaHoy.uds}</p>
                          )}
                        </div>
                        {/* Importe hoy */}
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

          {/* ── RANKING HOY ── */}
          {metaHoy && dailyRanking.length > 0 && (
            <div className="mt-10">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Ranking de hoy</h2>
                <p className="text-sm text-gray-400 mt-0.5 capitalize">{hoy} · Progreso hacia la meta del día</p>
              </div>
              <div className="space-y-3">
                {dailyRanking.map((asesor, index) => {
                  const vh  = ventaHoyMap[asesor.id] ?? { monto: 0, unidades: 0, transacciones: 0 };
                  const uptH = vh.transacciones > 0 ? vh.unidades / vh.transacciones : null;
                  const pctTxn = metaHoy.txn > 0 ? (vh.transacciones / metaHoy.txn) * 100 : 0;
                  const pctHoy = progresoHoy(vh, metaHoy);
                  const isTop3 = index < 3;

                  return (
                    <div
                      key={asesor.id}
                      className={`w-full border rounded-2xl p-5 ${isTop3 ? RANK_COLORS[index] : 'border-gray-100 bg-white'}`}
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
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                          pctHoy >= 100 ? 'text-green-600 bg-green-50' :
                          pctHoy >= 75  ? 'text-blue-700 bg-blue-50'  :
                          pctHoy >= 50  ? 'text-amber-600 bg-amber-50' :
                                          'text-orange-600 bg-orange-50'
                        }`}>
                          {pctHoy.toFixed(0)}%
                        </span>
                      </div>

                      {/* Barra de progreso Txn */}
                      {metaHoy.txn > 0 && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-500">Transacciones</span>
                            <span className="font-semibold text-gray-900">{vh.transacciones} / {metaHoy.txn}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${pctTxn >= 100 ? 'bg-green-500' : 'bg-gray-900'}`}
                              style={{ width: `${Math.min(100, pctTxn)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Grid de indicadores */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-white/70 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Txn</p>
                          <p className={`text-sm font-bold leading-tight ${metaHoy.txn > 0 && vh.transacciones >= metaHoy.txn ? 'text-green-600' : 'text-gray-900'}`}>
                            {vh.transacciones}
                          </p>
                          {metaHoy.txn > 0 && <p className="text-[10px] text-gray-400">/{metaHoy.txn}</p>}
                        </div>
                        <div className="bg-white/70 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">UPT</p>
                          <p className={`text-sm font-bold leading-tight ${metaHoy.upt > 0 && uptH !== null && uptH >= metaHoy.upt ? 'text-green-600' : 'text-gray-900'}`}>
                            {uptH !== null ? uptH.toFixed(1) : '—'}
                          </p>
                          {metaHoy.upt > 0 && <p className="text-[10px] text-gray-400">/{metaHoy.upt}</p>}
                        </div>
                        <div className="bg-white/70 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Uds</p>
                          <p className={`text-sm font-bold leading-tight ${metaHoy.uds > 0 && vh.unidades >= metaHoy.uds ? 'text-green-600' : 'text-gray-900'}`}>
                            {vh.unidades}
                          </p>
                          {metaHoy.uds > 0 && <p className="text-[10px] text-gray-400">/{metaHoy.uds}</p>}
                        </div>
                        <div className="bg-white/70 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Importe</p>
                          <p className="text-sm font-bold text-gray-900 leading-tight">
                            {vh.monto > 0 ? formatCurrency(vh.monto) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {showTutorial === true && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showLeaderModal && <LeaderModal onClose={() => setShowLeaderModal(false)} />}

      {pinAsesor && (
        <PinModal
          asesor={pinAsesor}
          onSuccess={() => {
            setVentasAsesor(pinAsesor);
            setPinAsesor(null);
          }}
          onClose={() => setPinAsesor(null)}
        />
      )}

      {ventasAsesor && (
        <VentasModal
          asesor={ventasAsesor}
          metaMensual={metasMap[ventasAsesor.id]?.metaMensual ?? 0}
          totalVentas={ventasMap[ventasAsesor.id]?.totalVentas ?? 0}
          onClose={() => setVentasAsesor(null)}
        />
      )}
    </main>
    </StoreProvider>
  );
}
