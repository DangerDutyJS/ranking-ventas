'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { leaderPasswordExists, createLeaderPassword, verifyLeaderPassword, reauthWithGoogle } from '@/lib/leaderAuth';
import { useStoreId } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';

interface LeaderModalProps {
  onClose: () => void;
}

type Mode = 'loading' | 'create' | 'verify' | 'forgot' | 'newpassword';

export default function LeaderModal({ onClose }: LeaderModalProps) {
  const router = useRouter();
  const storeId = useStoreId();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirm, setNewConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    leaderPasswordExists(storeId).then((exists) => setMode(exists ? 'verify' : 'create'));
  }, [storeId]);

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

  const handleReauth = async () => {
    setError('');
    setLoading(true);
    try {
      await reauthWithGoogle();
      setMode('newpassword');
    } catch {
      setError('No se pudo verificar tu identidad. Intenta de nuevo.');
    }
    setLoading(false);
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 4) return setError('Mínimo 4 caracteres.');
    if (newPassword !== newConfirm) return setError('Las contraseñas no coinciden.');
    if (!user) return;
    setLoading(true);
    try {
      await createLeaderPassword(storeId, newPassword);
      sessionStorage.setItem('leader-access', '1');
      router.push('/lider');
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
      setLoading(false);
    }
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
              <p className="mt-1 text-sm text-gray-500">Confirma tu identidad con Google para crear una nueva contraseña.</p>
            </div>
            {error && <p className="text-xs text-red-500 mb-4">{error}</p>}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleReauth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Verificando...' : 'Confirmar con Google'}
              </button>
              <button
                type="button"
                onClick={() => { setError(''); setMode('verify'); }}
                className="w-full px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Volver
              </button>
            </div>
          </>
        )}

        {mode === 'newpassword' && (
          <>
            <div className="mb-6">
              <h2 className="text-base font-semibold text-gray-900">Nueva contraseña</h2>
              <p className="mt-1 text-sm text-gray-500">Elige una nueva contraseña para el acceso de líder.</p>
            </div>
            <form onSubmit={handleNewPassword} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
                <input type="password" autoComplete="new-password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
                  placeholder="Mínimo 4 caracteres" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar contraseña</label>
                <input type="password" autoComplete="new-password" value={newConfirm}
                  onChange={(e) => setNewConfirm(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
                  placeholder="Repite la contraseña" />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
                {loading ? 'Guardando...' : 'Guardar y entrar'}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
