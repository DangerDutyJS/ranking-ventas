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

type Tab = 'asesores' | 'meta' | 'diarias' | 'dinamicas';

const TAB_LABELS: Record<Tab, string> = {
  asesores:  'Asesores',
  meta:      'Meta del mes',
  diarias:   'Metas diarias',
  dinamicas: 'Dinámicas',
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
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">Dashboard Líder</span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Solo líder</span>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6 overflow-x-auto">
        <div className="flex gap-6 min-w-max">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setShowForm(false); }}
              className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Tab Asesores */}
        {tab === 'asesores' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Asesores</h1>
                <p className="mt-0.5 text-sm text-gray-500">Equipo de ventas registrado.</p>
              </div>
              {!showForm && (
                <button onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo asesor
                </button>
              )}
            </div>

            {successMsg && (
              <div className="mb-6 px-4 py-3 bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl">
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
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Meta del mes</h1>
              <p className="mt-0.5 text-sm text-gray-500">
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
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Metas diarias</h1>
              <p className="mt-0.5 text-sm text-gray-500">
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
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Dinámicas comerciales</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Retos del día con meta individual por asesor y seguimiento en tiempo real.
              </p>
            </div>
            <DinamicasTab />
          </>
        )}
      </div>
    </main>
    </StoreProvider>
  );
}
