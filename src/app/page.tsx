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
import { calcularMetas } from '@/lib/calcularMetas';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  cargo: string;
  fotoBase64: string;
  pinHash?: string;
}

interface VentaMes {
  asesorId: string;
  totalVentas: number;
  totalUnidades: number;
  totalTransacciones: number;
}

interface Meta {
  montoTotal: number;
  asesores: Record<string, { diasLaborados: number }>;
}

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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


function diasLaboralesRestantes(diasLaborados: number): number {
  const hoy = new Date();
  const diasTotales = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const proporcion = Math.max(0, diasTotales - hoy.getDate()) / diasTotales;
  return Math.max(1, Math.round(diasLaborados * proporcion));
}

function barColor(p: number) {
  if (p >= 100) return 'bg-green-500';
  if (p >= 75)  return 'bg-blue-500';
  if (p >= 50)  return 'bg-amber-500';
  if (p >= 25)  return 'bg-orange-500';
  return 'bg-red-500';
}

function motivacion(p: number) {
  if (p >= 100) return { text: '¡Meta cumplida!', color: 'text-green-600 bg-green-50' };
  if (p >= 75)  return { text: '¡Casi lo logras!', color: 'text-blue-600 bg-blue-50' };
  if (p >= 50)  return { text: '¡Buen ritmo!', color: 'text-amber-600 bg-amber-50' };
  if (p >= 25)  return { text: '¡Sigue adelante!', color: 'text-orange-600 bg-orange-50' };
  return { text: '¡Empieza hoy!', color: 'text-red-600 bg-red-50' };
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
          if (data.mes === mes) {
            map[data.asesorId] = data;
          }
        });
        setVentasMap(map);
      },
      (err) => console.error('ventasMes:', err)
    );
  }, [user, mes]);

  if (authLoading || !user) return null;

  const metasMap = meta && asesores.length > 0
    ? calcularMetas(meta.montoTotal, asesores.map((a) => a.id), meta.asesores)
    : {};

  const ranking = [...asesores].sort((a, b) => (ventasMap[b.id]?.totalVentas ?? 0) - (ventasMap[a.id]?.totalVentas ?? 0));

  const mesNombre = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  return (
    <StoreProvider storeId={user.uid}>
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
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
        {/* Título */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight capitalize">{mesNombre}</h1>
          {meta ? (
            <p className="text-sm text-gray-400 mt-0.5">Meta total: {formatCurrency(meta.montoTotal)} · {asesores.length} asesores</p>
          ) : (
            <p className="text-sm text-gray-400 mt-0.5">No hay meta configurada para este mes.</p>
          )}
        </div>

        {/* Ranking */}
        {dataLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : asesores.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">No hay asesores registrados aún.</p>
        ) : (
          <div className="space-y-3">
            {ranking.map((asesor, index) => {
              const vm = ventasMap[asesor.id];
              // IMPORTE acumulado del mes
              const totalVentas       = vm?.totalVentas       ?? 0;
              const totalUnidades     = vm?.totalUnidades     ?? 0;
              const totalTransacciones = vm?.totalTransacciones ?? 0;
              // UPT = unidades / transacciones
              const upt = totalTransacciones > 0 ? totalUnidades / totalTransacciones : null;
              // ABT = importe / transacciones
              const abt = totalTransacciones > 0 ? totalVentas / totalTransacciones : null;

              const mc = metasMap[asesor.id];
              const metaMensual = mc?.metaMensual ?? 0;
              const diasLab = mc?.diasLaborados ?? 0;
              const progreso  = metaMensual > 0 ? Math.min(100, (totalVentas / metaMensual) * 100) : 0;
              const faltaMes  = Math.max(0, metaMensual - totalVentas);
              // Promedio diario requerido (dinámico): faltaMes / días laborales que quedan estimados
              const diasRestLab = diasLaboralesRestantes(diasLab);
              const promedioDiario = faltaMes > 0 && diasLab > 0 ? faltaMes / diasRestLab : null;

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
                  {/* Fila superior: posición + avatar + nombre + badge */}
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

                  {/* Barra de progreso */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500">Progreso mensual</span>
                      <span className="font-semibold text-gray-900">{progreso.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${barColor(progreso)}`}
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                  </div>

                  {/* Fila 1: Importe + Falta para meta */}
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

                  {/* Fila 2: UPT + ABT (solo si hay transacciones) */}
                  {upt !== null && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-white/70 rounded-xl px-3 py-2">
                        <p className="text-xs text-gray-400">UPT</p>
                        <p className="text-sm font-bold text-gray-900">{upt.toFixed(2)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{totalUnidades} uds ÷ {totalTransacciones} txn</p>
                      </div>
                      <div className="bg-white/70 rounded-xl px-3 py-2">
                        <p className="text-xs text-gray-400">ABT</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(abt!)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(totalVentas)} ÷ {totalTransacciones} txn</p>
                      </div>
                    </div>
                  )}

                  {/* Fila 3: Promedio diario requerido (dinámico) + Meta ajustada */}
                  {mc && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-white/70 rounded-xl px-3 py-2">
                        <p className="text-xs text-gray-400">Promedio diario requerido</p>
                        {promedioDiario !== null
                          ? <>
                              <p className="text-sm font-bold text-orange-600">{formatCurrency(promedioDiario)}</p>
                              <p className="text-xs text-gray-400 mt-0.5">por día · {diasRestLab}d restantes</p>
                            </>
                          : <p className="text-sm font-bold text-green-600">¡Meta cumplida!</p>
                        }
                      </div>
                      <div className="bg-white/70 rounded-xl px-3 py-2">
                        <p className="text-xs text-gray-400">Meta ajustada</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(mc.metaMensual)}</p>
                        <p className="text-xs mt-0.5">
                          {mc.esProporcional
                            ? <span className="text-orange-500">{mc.diasLaborados}/{mc.diasMes} días</span>
                            : mc.redistribucion > 0
                              ? <span className="text-blue-500">+{formatCurrency(mc.redistribucion)} redistrib.</span>
                              : <span className="text-gray-400">Base directa</span>
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modales */}
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
          metaDiaria={(() => {
            const mc = metasMap[ventasAsesor.id];
            return mc && mc.diasLaborados > 0 ? mc.metaMensual / mc.diasLaborados : 0;
          })()}
          totalVentas={ventasMap[ventasAsesor.id]?.totalVentas ?? 0}
          onClose={() => setVentasAsesor(null)}
        />
      )}
    </main>
    </StoreProvider>
  );
}
