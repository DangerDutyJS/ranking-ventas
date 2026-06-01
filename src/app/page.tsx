'use client';

import { useAuth } from '@/context/AuthContext';
import { StoreProvider } from '@/context/StoreContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import LeaderModal from '@/components/LeaderModal';
import PinModal from '@/components/PinModal';
import VentasModal from '@/components/VentasModal';
import HistorialVentasDiaModal from '@/components/HistorialVentasDiaModal';
import NotificacionesPanel from '@/components/NotificacionesPanel';
import InstallPWA from '@/components/InstallPWA';
import HistorialAcumuladoModal from '@/components/HistorialAcumuladoModal';
import TutorialModal from '@/components/TutorialModal';
import DinamicaProgressModal from '@/components/DinamicaProgressModal';
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

interface RegistroDinamica {
  cantidad: number;
  creadoEn: string;
}

interface Dinamica {
  id: string;
  nombre: string;
  meta: number;
  fecha: string;
  activa: boolean;
  asesoresIds: string[];
  progreso: Record<string, number>;
  registros?: Record<string, RegistroDinamica[]>;
}

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function mesAnterior() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesHaceDosMeses() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fechaHoy() {
  return new Date().toLocaleDateString('fr-CA');
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

const MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = [
  'border-amber-200 bg-amber-50/50',
  'border-slate-200 bg-slate-50/50',
  'border-orange-200 bg-orange-50/40',
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

interface ComisionResult {
  pct: number;
  talento: 'amarillo' | 'verde' | 'azul' | 'celeste' | null;
  comision: number | null;
  falta90: number;
  falta100: number;
  falta110: number;
  falta120: number;
}

function calcularComision(metaAsignada: number, montoVendido: number): ComisionResult {
  const pct = metaAsignada > 0 ? (montoVendido / metaAsignada) * 100 : 0;
  const meta90  = metaAsignada * 0.90;
  const meta100 = metaAsignada * 1.00;
  const meta110 = metaAsignada * 1.10;
  const meta120 = metaAsignada * 1.20;

  let talento: ComisionResult['talento'] = null;
  let comision: number | null = null;
  if (pct >= 120)       { talento = 'celeste';  comision = 1.30; }
  else if (pct >= 110)  { talento = 'azul';     comision = 1.20; }
  else if (pct >= 100)  { talento = 'verde';    comision = 1.10; }
  else if (pct >= 90)   { talento = 'amarillo'; comision = 0.65; }

  return {
    pct,
    talento,
    comision,
    falta90:  Math.max(0, meta90  - montoVendido),
    falta100: Math.max(0, meta100 - montoVendido),
    falta110: Math.max(0, meta110 - montoVendido),
    falta120: Math.max(0, meta120 - montoVendido),
  };
}

const COMISION_ROWS: { talento: ComisionResult['talento']; label: string; rango: string; pago: string; bg: string; text: string; border: string }[] = [
  { talento: 'amarillo', label: 'Amarillo', rango: '90% – 99.99%',  pago: '0.65%', bg: 'bg-yellow-50',  text: 'text-yellow-800', border: 'border-yellow-300' },
  { talento: 'verde',    label: 'Verde',    rango: '100% – 109.99%', pago: '1.10%', bg: 'bg-green-50',   text: 'text-green-800',  border: 'border-green-300'  },
  { talento: 'azul',     label: 'Azul',     rango: '110% – 119.99%', pago: '1.20%', bg: 'bg-blue-50',    text: 'text-blue-800',   border: 'border-blue-300'   },
  { talento: 'celeste',  label: 'Celeste',  rango: '≥ 120%',         pago: '1.30%', bg: 'bg-sky-50',     text: 'text-sky-800',    border: 'border-sky-300'    },
];

function TablaComisionesAsesor({ meta, vendido }: { meta: number; vendido: number }) {
  if (meta <= 0) return null;
  const { talento, comision, falta90, falta100, falta110, falta120 } = calcularComision(meta, vendido);
  return (
    <div className="mt-3 rounded-md border border-[#eaeaea] overflow-hidden">
      <div className="px-3 pt-2.5 pb-1.5 border-b border-[#eaeaea] bg-[#fafafa]">
        <p className="text-[11px] font-medium text-[#8f8f8f] uppercase tracking-[0.06em]">Comisiones</p>
      </div>
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="bg-[#fafafa] border-b border-[#eaeaea]">
            <th className="px-3 py-2 text-left font-medium text-[#8f8f8f]">Talento</th>
            <th className="px-3 py-2 text-center font-medium text-[#8f8f8f]">Cumplimiento</th>
            <th className="px-3 py-2 text-right font-medium text-[#8f8f8f]">Pago</th>
          </tr>
        </thead>
        <tbody>
          {COMISION_ROWS.map((row) => {
            const isActive = talento === row.talento;
            return (
              <tr
                key={row.talento}
                className={`border-b border-[#f2f2f2] last:border-0 transition-colors ${isActive ? `${row.bg} border-l-2 ${row.border}` : 'bg-white'}`}
              >
                <td className={`px-3 py-2 font-semibold ${isActive ? row.text : 'text-[#8f8f8f]'}`}>
                  {isActive && <span className="mr-1">›</span>}{row.label}
                </td>
                <td className={`px-3 py-2 text-center tabular-nums ${isActive ? row.text : 'text-[#8f8f8f]'}`}>{row.rango}</td>
                <td className={`px-3 py-2 text-right font-bold tabular-nums ${isActive ? row.text : 'text-[#8f8f8f]'}`}>{row.pago}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {comision !== null && (
        <div className="px-3 py-2 bg-[#fafafa] border-t border-[#eaeaea]">
          <p className="text-[12px] text-[#8f8f8f]">
            Comisión estimada:{' '}
            <span className="font-semibold text-gray-800">{formatCurrency(vendido * 0.81 * comision / 100)}</span>
            <span className="text-[#8f8f8f]"> ({comision}% sobre {formatCurrency(vendido * 0.81)} sin IVA)</span>
          </p>
        </div>
      )}
      {(falta90 > 0 || falta100 > 0 || falta110 > 0 || falta120 > 0) && (
        <div className="px-3 py-2.5 space-y-1.5 border-t border-[#eaeaea]">
          {falta90 > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#8f8f8f]">Para 90% <span className="text-yellow-600 font-medium">(Amarillo)</span></span>
              <span className="text-[12px] font-semibold text-gray-700 tabular-nums">{formatCurrency(falta90)}</span>
            </div>
          )}
          {falta100 > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#8f8f8f]">Para 100% <span className="text-green-600 font-medium">(Verde)</span></span>
              <span className="text-[12px] font-semibold text-gray-700 tabular-nums">{formatCurrency(falta100)}</span>
            </div>
          )}
          {falta110 > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#8f8f8f]">Para 110% <span className="text-blue-600 font-medium">(Azul)</span></span>
              <span className="text-[12px] font-semibold text-gray-700 tabular-nums">{formatCurrency(falta110)}</span>
            </div>
          )}
          {falta120 > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#8f8f8f]">Para 120% <span className="text-sky-600 font-medium">(Celeste)</span></span>
              <span className="text-[12px] font-semibold text-gray-700 tabular-nums">{formatCurrency(falta120)}</span>
            </div>
          )}
        </div>
      )}
      {falta90 === 0 && falta100 === 0 && falta120 === 0 && (
        <div className="px-3 py-2 border-t border-[#eaeaea] bg-sky-50">
          <p className="text-[12px] text-sky-600 font-semibold text-center">🏖️ Nivel máximo alcanzado</p>
        </div>
      )}
    </div>
  );
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
  const [ventasMapAnterior, setVentasMapAnterior] = useState<Record<string, VentaMes>>({});
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaAnterior, setMetaAnterior] = useState<Meta | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [showLeaderModal, setShowLeaderModal] = useState(false);
  const [pinAsesor, setPinAsesor] = useState<Asesor | null>(null);
  const [pinMode, setPinMode] = useState<'diario' | 'acumulado' | 'dinamica'>('diario');
  const [ventasAsesor, setVentasAsesor] = useState<Asesor | null>(null);
  const [acumuladoAsesor, setAcumuladoAsesor] = useState<Asesor | null>(null);
  const [showTutorial, setShowTutorial] = useState<boolean | null>(null);
  const [pinDinamicaRef, setPinDinamicaRef] = useState<Dinamica | null>(null);
  const [dinamicaProgressData, setDinamicaProgressData] = useState<{ asesor: Asesor; dinamica: Dinamica } | null>(null);
  const [dinamicas, setDinamicas] = useState<Dinamica[]>([]);

  const mes = mesActual();
  const mesAnt = mesAnterior();

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
        const mapAnt: Record<string, VentaMes> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as VentaMes & { mes: string };
          if (data.mes === mes) map[data.asesorId] = data;
          else if (data.mes === mesAnt) mapAnt[data.asesorId] = data;
        });
        setVentasMap(map);
        setVentasMapAnterior(mapAnt);
      },
      (err) => console.error('ventasMes:', err)
    );
  }, [user, mes, mesAnt]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'tiendas', user.uid, 'metas', mesAnt)).then((snap) => {
      if (snap.exists()) setMetaAnterior(snap.data() as Meta);
    });
    const mesViejo = mesHaceDosMeses();
    getDocs(query(collection(db, 'tiendas', user.uid, 'ventasMes'), where('mes', '==', mesViejo)))
      .then((snap) => snap.docs.forEach((d) => deleteDoc(d.ref)));
    deleteDoc(doc(db, 'tiendas', user.uid, 'metas', mesViejo)).catch(() => {});
  }, [user, mesAnt]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toLocaleDateString('fr-CA');
    const q = query(
      collection(db, 'tiendas', user.uid, 'dinamicas'),
      where('fecha', '==', today)
    );
    return onSnapshot(q, (snap) => {
      setDinamicas(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Dinamica)).filter((d) => d.activa)
      );
    });
  }, [user]);

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
  const mesAntNombre = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  const todayDate = new Date();
  const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
  const diasRestantes = Math.max(1, daysInMonth - todayDate.getDate() + 1);

  const metasMapAnterior = metaAnterior && asesores.length > 0
    ? calcularMetas(metaAnterior.montoTotal, asesorIds, metaAnterior.asesores)
    : {};
  const txnPorAsesorAnterior = metaAnterior?.metaTransacciones && metaAnterior.asesores
    ? distribuirIndicador(metaAnterior.metaTransacciones, asesorIds, metaAnterior.asesores)
    : {};
  const udsPorAsesorAnterior = metaAnterior?.metaUnidades && metaAnterior.asesores
    ? distribuirIndicador(metaAnterior.metaUnidades, asesorIds, metaAnterior.asesores)
    : {};

  const rankingAnterior = [...asesores]
    .filter((a) => {
      const vm = ventasMapAnterior[a.id];
      return (vm?.totalVentas ?? 0) + (vm?.acumuladoMes?.monto ?? 0) > 0;
    })
    .sort((a, b) => {
      const vmA = ventasMapAnterior[a.id];
      const vmB = ventasMapAnterior[b.id];
      const totalA = (vmA?.totalVentas ?? 0) + (vmA?.acumuladoMes?.monto ?? 0);
      const totalB = (vmB?.totalVentas ?? 0) + (vmB?.acumuladoMes?.monto ?? 0);
      return totalB - totalA;
    });

  return (
    <StoreProvider storeId={user.uid}>
    <main className="min-h-screen bg-dot-grid">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#eaeaea] px-6 py-4 flex items-center justify-between relative">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center">
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
          <InstallPWA />
          <NotificacionesPanel />
          <button onClick={() => setShowLeaderModal(true)}
            className="inline-flex items-center gap-1.5 text-[12px] text-[#8f8f8f] border border-[#eaeaea] px-3 h-8 rounded-md hover:bg-[#fafafa] hover:text-gray-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Líder
          </button>
          <button onClick={logout} className="text-[12px] text-[#8f8f8f] hover:text-gray-900 transition-colors">Salir</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight capitalize">{mesNombre}</h1>
          {meta ? (
            <p className="text-sm text-gray-400 mt-1">Meta total: {formatCurrency(meta.montoTotal)} · {asesores.length} asesores</p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">No hay meta configurada para este mes.</p>
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
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse" />
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Ranking de hoy</h2>
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
                        className={`w-full text-left border rounded-xl p-5 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 active:scale-[0.99] animate-slide-up ${isTop3 ? RANK_COLORS[index] : 'border-[#eaeaea] bg-white'}`}
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

                        {/* Indicadores individuales — siempre visibles */}
                        <div className="rounded-xl border border-gray-100 bg-white/70 px-3 py-2.5 space-y-2.5">
                          <IndicatorBar
                            label="Txn"
                            value={String(vh.transacciones)}
                            meta={txnMeta > 0 ? String(Math.round(txnMeta)) : null}
                            pct={pctTxn}
                            barColor="bg-gradient-to-r from-violet-400 to-purple-500"
                          />
                          <IndicatorBar
                            label="Uds"
                            value={String(vh.unidades)}
                            meta={udsMeta > 0 ? String(Math.round(udsMeta)) : null}
                            pct={pctUds}
                            barColor="bg-gradient-to-r from-orange-400 to-amber-500"
                          />
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

                        {/* Dinámicas del asesor hoy */}
                        {(() => {
                          const dinAsesor = dinamicas.filter((d) => d.asesoresIds.includes(asesor.id));
                          if (dinAsesor.length === 0) return null;
                          return (
                            <div className="mt-2.5 rounded-xl border border-violet-100/80 bg-violet-50/30 px-3 py-2.5 space-y-2.5">
                              <p className="text-[10px] font-medium text-violet-400 uppercase tracking-wide">Dinámicas</p>
                              {dinAsesor.map((din) => {
                                const val = din.progreso?.[asesor.id] ?? 0;
                                const pct = din.meta > 0 ? Math.min(100, (val / din.meta) * 100) : 0;
                                const textC = pct >= 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-rose-600';
                                return (
                                  <div key={din.id} className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-500 truncate flex-1">{din.nombre}</span>
                                      <span className="text-xs text-gray-400 flex-shrink-0">{val}/{din.meta}</span>
                                      <span className={`text-xs font-semibold w-9 text-right flex-shrink-0 ${textC}`}>{pct.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                      <div
                                        className="h-1.5 rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all duration-300"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── DINÁMICAS DEL DÍA ── */}
            {dinamicas.length > 0 && (
              <div className={showDailySection ? 'mt-8' : ''}>
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="flex h-2 w-2 rounded-full bg-violet-400 ring-2 ring-violet-400/30" />
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Dinámicas del día</h2>
                  </div>
                  <p className="text-sm text-gray-400 capitalize">
                    {dinamicas.length} dinámica{dinamicas.length !== 1 ? 's' : ''} activa{dinamicas.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="space-y-3">
                  {dinamicas.map((din) => {
                    const participantes = asesores.filter((a) => din.asesoresIds.includes(a.id));
                    const totalVal  = participantes.reduce((s, a) => s + (din.progreso?.[a.id] ?? 0), 0);
                    const totalMeta = din.meta * (participantes.length || 1);
                    const pctGlobal = totalMeta > 0 ? (totalVal / totalMeta) * 100 : 0;
                    return (
                      <div key={din.id} className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-50">
                          <div className="flex items-center justify-between gap-3 mb-2.5">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900">{din.nombre}</h3>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Meta {din.meta} por asesor · {totalVal} / {totalMeta} total
                              </p>
                            </div>
                            <span className={`text-lg font-bold tabular-nums flex-shrink-0 ${
                              pctGlobal >= 100 ? 'text-emerald-600' : pctGlobal >= 80 ? 'text-amber-600' : 'text-rose-600'
                            }`}>
                              {pctGlobal.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${
                                pctGlobal >= 100 ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
                                pctGlobal >= 80  ? 'bg-gradient-to-r from-amber-400 to-yellow-400' :
                                                   'bg-gradient-to-r from-rose-400 to-red-400'
                              }`}
                              style={{ width: `${Math.min(100, pctGlobal)}%` }}
                            />
                          </div>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {participantes.map((asesor) => {
                            const val = din.progreso?.[asesor.id] ?? 0;
                            const pct = din.meta > 0 ? Math.min(100, (val / din.meta) * 100) : 0;
                            const fillC = pct >= 100
                              ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                              : pct >= 80
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-400'
                              : 'bg-gradient-to-r from-rose-400 to-red-400';
                            const textC = pct >= 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-rose-600';
                            return (
                              <button
                                key={asesor.id}
                                onClick={() => {
                                  setPinMode('dinamica');
                                  setPinDinamicaRef(din);
                                  setPinAsesor(asesor);
                                }}
                                className="w-full text-left px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                    {asesor.fotoBase64
                                      ? <Image src={asesor.fotoBase64} alt={asesor.nombre} width={28} height={28} className="w-full h-full object-cover" />
                                      : <span className="text-xs font-semibold text-gray-400">{asesor.nombre[0]}</span>}
                                  </div>
                                  <span className="text-sm text-gray-700 font-medium flex-1 truncate">
                                    {asesor.nombre} {asesor.apellido}
                                  </span>
                                  <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">{val} / {din.meta}</span>
                                  <span className={`text-xs font-bold tabular-nums w-9 text-right flex-shrink-0 ${textC}`}>
                                    {pct.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all duration-300 ${fillC}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── RANKING MENSUAL: todos los asesores ── */}
            <div className={showDailySection || dinamicas.length > 0 ? 'mt-10' : ''}>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Ranking mensual</h2>
                <p className="text-sm text-gray-400 mt-1 capitalize">{mesNombre} · {asesores.length} asesores</p>
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
                      className={`w-full text-left border rounded-xl p-5 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 active:scale-[0.99] animate-slide-up ${
                        isTop3 ? RANK_COLORS[index] : 'border-[#eaeaea] bg-white'
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
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                                📌 Pin
                              </span>
                              {progreso >= 110 && (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-indigo-700 font-medium border border-indigo-200">
                                  🎁 Bono corral
                                </span>
                              )}
                              {progreso >= 120 && (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-medium border border-sky-200">
                                  🏖️ Día libre
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Mini-barra hacia el siguiente nivel */}
                        {progreso >= 100 && progreso < 120 && (() => {
                          const isTo110  = progreso < 110;
                          const from     = isTo110 ? 100 : 110;
                          const to       = isTo110 ? 110 : 120;
                          const miniPct  = Math.min(100, ((progreso - from) / (to - from)) * 100);
                          const falta    = (to - progreso).toFixed(1);
                          const label    = isTo110 ? '🎁 Bono corral' : '🏖️ Día libre';
                          const fill     = isTo110
                            ? 'bg-gradient-to-r from-indigo-400 to-blue-500'
                            : 'bg-gradient-to-r from-sky-400 to-cyan-400';
                          const tColor   = isTo110 ? 'text-indigo-600' : 'text-sky-600';
                          const bg       = isTo110
                            ? 'bg-blue-50 border border-indigo-100'
                            : 'bg-sky-50 border border-sky-100';
                          return (
                            <div className={`mt-2.5 rounded-md px-3 py-2.5 ${bg}`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-xs font-semibold ${tColor}`}>Siguiente: {label}</span>
                                <span className={`text-xs tabular-nums font-medium ${tColor}`}>+{falta}% más</span>
                              </div>
                              <div className="w-full bg-white/60 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-700 ${fill}`}
                                  style={{ width: `${miniPct}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                <span>{from}%</span>
                                <span>{to}%</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#fafafa] border border-[#eaeaea] rounded-md px-3 py-2">
                          <p className="text-[11px] text-[#8f8f8f]">Importe</p>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(totalVentas)}</p>
                        </div>
                        <div className={`border rounded-md px-3 py-2 ${progreso >= 100 ? 'bg-emerald-50 border-emerald-200' : 'bg-[#fafafa] border-[#eaeaea]'}`}>
                          <p className="text-[11px] text-[#8f8f8f]">{progreso >= 100 ? 'Excedente' : 'Falta para meta'}</p>
                          <p className={`text-sm font-semibold ${progreso >= 100 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {formatCurrency(progreso >= 100 ? totalVentas - metaMensual : faltaMes)}
                          </p>
                        </div>
                      </div>

                      {faltaMes > 0 && metaMensual > 0 && (
                        <div className="mt-2 flex items-center justify-between bg-[#fafafa] border border-[#eaeaea] rounded-md px-3 py-2">
                          <span className="text-[11px] text-[#8f8f8f]">Promedio / día</span>
                          <span className="text-[12px] font-semibold text-gray-700">
                            {formatCurrency(faltaMes / diasRestantes)}
                            <span className="text-[#8f8f8f] font-normal"> · {diasRestantes} día{diasRestantes !== 1 ? 's' : ''}</span>
                          </span>
                        </div>
                      )}

                      {vm?.acumuladoMes && (vm.acumuladoMes.monto > 0 || vm.acumuladoMes.transacciones > 0 || vm.acumuladoMes.unidades > 0) && (
                        <div className="mt-2 flex items-center justify-between bg-[#fafafa] border border-[#eaeaea] rounded-md px-3 py-2">
                          <span className="text-[11px] text-indigo-500">Acumulado ingresado</span>
                          <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                            {vm.acumuladoMes.monto > 0 && <span>{formatCurrency(vm.acumuladoMes.monto)}</span>}
                            {vm.acumuladoMes.transacciones > 0 && <span className="text-gray-400">· {vm.acumuladoMes.transacciones} txn</span>}
                            {vm.acumuladoMes.unidades > 0 && <span className="text-gray-400">· {vm.acumuladoMes.unidades} uds</span>}
                          </div>
                        </div>
                      )}

                      {showIndicators && (
                        <div className="mt-3 rounded-md border border-[#eaeaea] bg-[#fafafa] px-3 py-2.5 space-y-2.5">
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

                      <TablaComisionesAsesor meta={metaMensual} vendido={totalVentas} />

                      {/* Sección Hoy: solo cuando no hay ranking de hoy separado */}
                      {!showDailySection && hasHoyData && (
                        <div className="mt-3 pt-3 border-t border-[#eaeaea]">
                          <div className="flex items-center justify-between mb-2.5">
                            <p className="text-[11px] font-medium text-[#8f8f8f] uppercase tracking-[0.06em]">Hoy</p>
                            <p className="text-[11px] text-[#8f8f8f]">{hoy}</p>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            <div className="bg-[#fafafa] border border-[#eaeaea] rounded-md p-2 text-center">
                              <p className="text-[10px] text-[#8f8f8f] mb-0.5">Txn</p>
                              <p className="text-sm font-semibold leading-tight text-gray-900">
                                {ventaHoy.transacciones}
                              </p>
                            </div>
                            <div className="bg-[#fafafa] border border-[#eaeaea] rounded-md p-2 text-center">
                              <p className="text-[10px] text-[#8f8f8f] mb-0.5">UPT</p>
                              <p className="text-sm font-semibold leading-tight text-gray-900">
                                {uptHoy !== null ? uptHoy.toFixed(1) : '—'}
                              </p>
                            </div>
                            <div className="bg-[#fafafa] border border-[#eaeaea] rounded-md p-2 text-center">
                              <p className="text-[10px] text-[#8f8f8f] mb-0.5">Uds</p>
                              <p className="text-sm font-semibold leading-tight text-gray-900">
                                {ventaHoy.unidades}
                              </p>
                            </div>
                            <div className="bg-[#fafafa] border border-[#eaeaea] rounded-md p-2 text-center">
                              <p className="text-[10px] text-[#8f8f8f] mb-0.5">Importe</p>
                              <p className="text-sm font-semibold text-gray-900 leading-tight">
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

            {/* ── HISTORIAL MES ANTERIOR ── */}
            {rankingAnterior.length > 0 && (
              <div className="mt-10">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 13h12l1-13M10 12h4" />
                    </svg>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Mes anterior</h2>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 capitalize">
                    {mesAntNombre} · {rankingAnterior.length} asesor{rankingAnterior.length !== 1 ? 'es' : ''}
                  </p>
                </div>
                <div className="space-y-3">
                  {rankingAnterior.map((asesor, index) => {
                    const vm = ventasMapAnterior[asesor.id];
                    const totalVentas        = (vm?.totalVentas        ?? 0) + (vm?.acumuladoMes?.monto         ?? 0);
                    const totalUnidades      = (vm?.totalUnidades      ?? 0) + (vm?.acumuladoMes?.unidades      ?? 0);
                    const totalTransacciones = (vm?.totalTransacciones ?? 0) + (vm?.acumuladoMes?.transacciones ?? 0);

                    const mc          = metasMapAnterior[asesor.id];
                    const metaMensual = mc?.metaMensual ?? 0;
                    const progreso    = metaMensual > 0 ? (totalVentas / metaMensual) * 100 : 0;

                    const avt    = totalTransacciones > 0 ? totalVentas   / totalTransacciones : null;
                    const upt    = totalTransacciones > 0 ? totalUnidades / totalTransacciones : null;
                    const pctAVT = avt !== null && metaAnterior?.metaAVT ? (avt / metaAnterior.metaAVT) * 100 : null;
                    const metaUPTRef = metaAnterior?.metaUPT ?? null;
                    const pctUPT = upt !== null && metaUPTRef ? (upt / metaUPTRef) * 100 : null;

                    const metaTxnAsesor: number | null = (() => {
                      const v = txnPorAsesorAnterior[asesor.id];
                      if (v !== undefined && v > 0) return v;
                      return metaAnterior?.metaTransacciones && asesorIds.length > 0
                        ? metaAnterior.metaTransacciones / asesorIds.length : null;
                    })();
                    const metaUdsAsesor: number | null = (() => {
                      const v = udsPorAsesorAnterior[asesor.id];
                      if (v !== undefined && v > 0) return v;
                      return metaAnterior?.metaUnidades && asesorIds.length > 0
                        ? metaAnterior.metaUnidades / asesorIds.length : null;
                    })();
                    const pctTxn = metaTxnAsesor !== null ? (totalTransacciones / metaTxnAsesor) * 100 : null;
                    const pctUds = metaUdsAsesor !== null ? (totalUnidades / metaUdsAsesor) * 100 : null;

                    const showIndicators = metaMensual > 0 || avt !== null || upt !== null || pctTxn !== null || pctUds !== null;
                    const isTop3 = index < 3;
                    const { text: mot, color: motColor } = motivacion(progreso);

                    return (
                      <div
                        key={asesor.id}
                        className={`border rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] opacity-85 ${
                          isTop3 ? RANK_COLORS[index] : 'border-[#eaeaea] bg-white'
                        }`}
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
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${motColor}`}>{mot}</span>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Meta mensual</p>
                          <div className="flex-1 h-px bg-gray-100" />
                        </div>

                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-500">Progreso mensual</span>
                            <span className={`font-semibold ${
                              progreso >= 120 ? 'text-sky-600' : progreso >= 110 ? 'text-blue-700' :
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
                              >{label}</span>
                            ))}
                          </div>
                          {progreso >= 100 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-400 mb-1.5">Beneficios alcanzados</p>
                              <div className="flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">📌 Pin</span>
                                {progreso >= 110 && (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-indigo-700 font-medium border border-indigo-200">🎁 Bono corral</span>
                                )}
                                {progreso >= 120 && (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-medium border border-sky-200">🏖️ Día libre</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-[#fafafa] border border-[#eaeaea] rounded-md px-3 py-2">
                            <p className="text-[11px] text-[#8f8f8f]">Importe</p>
                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(totalVentas)}</p>
                          </div>
                          <div className={`border rounded-md px-3 py-2 ${progreso >= 100 ? 'bg-emerald-50 border-emerald-200' : 'bg-[#fafafa] border-[#eaeaea]'}`}>
                            <p className="text-[11px] text-[#8f8f8f]">{progreso >= 100 ? 'Excedente' : 'Falta para meta'}</p>
                            <p className={`text-sm font-semibold ${progreso >= 100 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {formatCurrency(progreso >= 100 ? totalVentas - metaMensual : Math.max(0, metaMensual - totalVentas))}
                            </p>
                          </div>
                        </div>

                        {showIndicators && (
                          <div className="mt-3 rounded-md border border-[#eaeaea] bg-[#fafafa] px-3 py-2.5 space-y-2.5">
                            {metaMensual > 0 && (
                              <IndicatorBar label="Monto" value={formatCurrency(totalVentas)} meta={formatCurrency(metaMensual)} pct={progreso} barColor="bg-gradient-to-r from-emerald-400 to-green-500" />
                            )}
                            {avt !== null && (
                              <IndicatorBar label="AVT" value={formatCurrency(avt)} meta={metaAnterior?.metaAVT ? formatCurrency(metaAnterior.metaAVT) : null} pct={pctAVT} barColor="bg-gradient-to-r from-blue-400 to-indigo-500" />
                            )}
                            {upt !== null && (
                              <IndicatorBar label="UPT" value={upt.toFixed(2)} meta={metaUPTRef ? metaUPTRef.toFixed(2) : null} pct={pctUPT} barColor="bg-gradient-to-r from-teal-400 to-cyan-500" />
                            )}
                            {pctTxn !== null && (
                              <IndicatorBar label="Transacc." value={String(totalTransacciones)} meta={String(Math.round(metaTxnAsesor!))} pct={pctTxn} barColor="bg-gradient-to-r from-violet-400 to-purple-500" />
                            )}
                            {(totalUnidades > 0 || metaUdsAsesor !== null) && (
                              <IndicatorBar label="Unidades" value={String(totalUnidades)} meta={metaUdsAsesor !== null ? String(Math.round(metaUdsAsesor)) : null} pct={pctUds} barColor="bg-gradient-to-r from-orange-400 to-amber-500" />
                            )}
                          </div>
                        )}

                        <TablaComisionesAsesor meta={metaMensual} vendido={totalVentas} />
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
            if (pinMode === 'diario') {
              setVentasAsesor(pinAsesor);
            } else if (pinMode === 'acumulado') {
              setAcumuladoAsesor(pinAsesor);
            } else if (pinMode === 'dinamica' && pinDinamicaRef) {
              setDinamicaProgressData({ asesor: pinAsesor!, dinamica: pinDinamicaRef });
            }
            setPinAsesor(null);
            setPinDinamicaRef(null);
          }}
          onClose={() => setPinAsesor(null)}
        />
      )}

      {ventasAsesor && (
        <HistorialVentasDiaModal
          asesor={ventasAsesor}
          dinamicas={dinamicas.filter((d) => d.asesoresIds.includes(ventasAsesor.id))}
          onClose={() => setVentasAsesor(null)}
        />
      )}

      {acumuladoAsesor && (
        <HistorialAcumuladoModal
          asesor={acumuladoAsesor}
          onClose={() => setAcumuladoAsesor(null)}
        />
      )}

      {dinamicaProgressData && (
        <DinamicaProgressModal
          dinamica={dinamicaProgressData.dinamica}
          asesor={dinamicaProgressData.asesor}
          onClose={() => setDinamicaProgressData(null)}
        />
      )}
    </main>
    </StoreProvider>
  );
}
