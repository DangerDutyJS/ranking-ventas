'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AsesorForm from '@/components/AsesorForm';

export default function LiderPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (typeof window !== 'undefined' && !sessionStorage.getItem('leader-access')) {
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

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Asesores</h1>
            <p className="mt-1 text-sm text-gray-500">Registra y gestiona el equipo de ventas.</p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
            >
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

        {showForm && (
          <AsesorForm
            onSuccess={handleSuccess}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </main>
  );
}
