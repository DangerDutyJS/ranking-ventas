'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import LeaderModal from '@/components/LeaderModal';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [showLeaderModal, setShowLeaderModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
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
            <span className="text-sm text-gray-600">{user.displayName}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Bienvenido, {user.displayName?.split(' ')[0]}.</p>

        <div className="mt-8">
          <button
            onClick={() => setShowLeaderModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Acceso Líder
          </button>
        </div>
      </div>

      {showLeaderModal && <LeaderModal onClose={() => setShowLeaderModal(false)} />}
    </main>
  );
}
