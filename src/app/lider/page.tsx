'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { StoreProvider } from '@/context/StoreContext';
import AsesorForm from '@/components/AsesorForm';
import AsesorList from '@/components/AsesorList';
import MetaMes from '@/components/MetaMes';
import MetasDiarias from '@/components/MetasDiarias';
import DinamicasTab from '@/components/DinamicasTab';
import EditorVentasMes from '@/components/EditorVentasMes';
import HistorialTab from '@/components/HistorialTab';

type Tab = 'asesores' | 'meta' | 'diarias' | 'dinamicas' | 'ventas' | 'historial';

const TAB_LABELS: Record<Tab, string> = {
  asesores:  'Asesores',
  meta:      'Meta del mes',
  diarias:   'Metas diarias',
  dinamicas: 'Dinámicas',
  ventas:    'Ventas del mes',
  historial: 'Historial',
};

export default function LiderPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('asesores');
  const [showForm, setShowForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!sessionStorage.getItem('leader-access')) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  const handleSuccess = () => {
    setShowForm(false);
    setSuccessMsg('Asesor registrado correctamente.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <StoreProvider storeId={user.uid}>
    <main className="theme-dark min-h-screen bg-dot-grid">
      <header className="bg-surface border-b border-gray-200 px-6 py-4 flex items-center justify-between relative">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-orange-500 via-amber-500 to-purple-600" />
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="text-gray-400 hover:text-gray-900 transition-colors p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-semibold text-heading text-sm">Dashboard Líder</span>
        </div>
        <span className="text-[11px] text-gray-400 bg-gray-100 px-2.5 py-1 rounded-md">Solo líder</span>
      </header>

      {/* Tabs */}
      <div className="bg-surface border-b border-gray-200 px-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setShowForm(false); }}
              className={`py-3 px-4 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t
                  ? 'border-orange-400 text-accent-text'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      {/* Guirnalda bajo las tabs: el contenedor de tabs tiene overflow-x-auto y la recortaría. */}
      <div className="relative h-0" aria-hidden="true">
        <div className="halloween-garland" />
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Tab Asesores */}
        {tab === 'asesores' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-heading">Asesores</h1>
                <p className="mt-0.5 text-[13px] text-accent-muted">Equipo de ventas registrado.</p>
              </div>
              {!showForm && (
                <button onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-4 h-9 bg-accent text-white text-[13px] font-medium rounded-md hover:bg-accent-hover transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo asesor
                </button>
              )}
            </div>

            {successMsg && (
              <div className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-md">
                {successMsg}
              </div>
            )}

            {showForm ? (
              <AsesorForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
            ) : (
              <AsesorList />
            )}
          </>
        )}

        {/* Tab Meta del mes */}
        {tab === 'meta' && (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-heading">Meta del mes</h1>
              <p className="mt-0.5 text-[13px] text-accent-muted">
                Monto total, días laborados e indicadores de referencia por asesor.
              </p>
            </div>
            <MetaMes />
          </>
        )}

        {/* Tab Metas diarias */}
        {tab === 'diarias' && (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-heading">Metas diarias</h1>
              <p className="mt-0.5 text-[13px] text-accent-muted">
                Objetivo por día de semana — UPT, transacciones y unidades según el tráfico esperado.
              </p>
            </div>
            <MetasDiarias />
          </>
        )}

        {/* Tab Dinámicas */}
        {tab === 'dinamicas' && (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-heading">Dinámicas comerciales</h1>
              <p className="mt-0.5 text-[13px] text-accent-muted">
                Retos del día con meta individual por asesor y seguimiento en tiempo real.
              </p>
            </div>
            <DinamicasTab />
          </>
        )}

        {/* Tab Ventas del mes */}
        {tab === 'ventas' && (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-heading">Ventas del mes</h1>
              <p className="mt-0.5 text-[13px] text-accent-muted">
                Edita los totales del ranking mensual de todos los asesores a la vez.
              </p>
            </div>
            <EditorVentasMes />
          </>
        )}

        {/* Tab Historial */}
        {tab === 'historial' && (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-heading">Historial</h1>
              <p className="mt-0.5 text-[13px] text-accent-muted">
                Consulta todos los meses anteriores con filtros por fecha, asesor e indicador. También puedes eliminar historial por rango de fechas.
              </p>
            </div>
            <HistorialTab />
          </>
        )}
      </div>
    </main>
    </StoreProvider>
  );
}
