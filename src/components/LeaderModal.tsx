'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { leaderPasswordExists, createLeaderPassword, verifyLeaderPassword, sendLeaderResetLink } from '@/lib/leaderAuth';
import { useStoreId } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';

interface LeaderModalProps {
  onClose: () => void;
}

type Mode = 'loading' | 'create' | 'verify' | 'forgot' | 'forgot-sent';

export default function LeaderModal({ onClose }: LeaderModalProps) {
  const router = useRouter();
  const storeId = useStoreId();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    leaderPasswordExists(storeId).then((exists) => setMode(exists ? 'verify' : 'create'));
  }, [storeId]);

  useEffect(() => {
    if (mode === 'forgot' && user?.email) setResetEmail(user.email);
  }, [mode, user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 4) return setError('La contraseña debe tener al menos 4 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setLoading(true);
    try {
      await createLeaderPassword(storeId, password);
      sessionStorage.setItem('leader-access', '1');
      router.push('/lider');
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await verifyLeaderPassword(storeId, password);
    if (ok) {
      sessionStorage.setItem('leader-access', '1');
      router.push('/lider');
    } else {
      setError('Contraseña incorrecta.');
      setLoading(false);
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!resetEmail.trim()) return setError('Ingresa tu correo.');
    setLoading(true);
    try {
      await sendLeaderResetLink(resetEmail.trim());
      setMode('forgot-sent');
    } catch {
      setError('No se pudo enviar el enlace. Verifica el correo e intenta de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-white rounded-2xl shadow-lg border border-gray-100 p-8">

        {mode === 'loading' && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        )}

        {mode === 'create' && (
          <>
            <div className="mb-6">
              <h2 className="text-base font-semibold text-gray-900">Crear contraseña de líder</h2>
              <p className="mt-1 text-sm text-gray-500">Define una contraseña para el acceso de líder.</p>
            </div>
            <form onSubmit={handleCreate} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
                <input type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
                  placeholder="Mínimo 4 caracteres" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar contraseña</label>
                <input type="password" autoComplete="new-password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
                  placeholder="Repite la contraseña" />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">{loading ? 'Guardando...' : 'Crear y entrar'}</button>
              </div>
            </form>
          </>
        )}

        {mode === 'verify' && (
          <>
            <div className="mb-6">
              <h2 className="text-base font-semibold text-gray-900">Acceso de líder</h2>
              <p className="mt-1 text-sm text-gray-500">Ingresa la contraseña para continuar.</p>
            </div>
            <form onSubmit={handleVerify} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
                <input type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
                  placeholder="••••••••" autoFocus />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">{loading ? 'Verificando...' : 'Entrar'}</button>
              </div>
            </form>
            <button
              type="button"
              onClick={() => { setError(''); setPassword(''); setMode('forgot'); }}
              className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <div className="mb-6">
              <h2 className="text-base font-semibold text-gray-900">Recuperar contraseña</h2>
              <p className="mt-1 text-sm text-gray-500">Te enviaremos un enlace a tu correo para crear una nueva contraseña.</p>
            </div>
            <form onSubmit={handleSendReset} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
                  placeholder="tu@correo.com"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setError(''); setMode('verify'); }}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Volver
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </div>
            </form>
          </>
        )}

        {mode === 'forgot-sent' && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Enlace enviado</p>
            <p className="text-xs text-gray-400 mb-2">Revisa tu correo <span className="font-medium text-gray-700">{resetEmail}</span> y haz clic en el enlace para crear una nueva contraseña.</p>
            <p className="text-xs text-gray-400 mb-6">El enlace expira en 1 hora.</p>
            <button onClick={onClose}
              className="w-full px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
