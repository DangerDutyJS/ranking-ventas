'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSignInWithEmailLink } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { completeLeaderReset, createLeaderPassword } from '@/lib/leaderAuth';
import { useAuth } from '@/context/AuthContext';

type Step = 'checking' | 'form' | 'done' | 'error';

export default function ResetPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (loading) return;

    const href = window.location.href;
    if (!isSignInWithEmailLink(auth, href)) {
      router.replace('/');
      return;
    }

    if (!user) {
      setErrorMsg('Debes iniciar sesión con Google primero. Inicia sesión y luego haz clic en el enlace del correo.');
      setStep('error');
      return;
    }

    completeLeaderReset(user, href)
      .then(() => setStep('form'))
      .catch(() => {
        setErrorMsg('El enlace es inválido o expiró. Solicita uno nuevo desde el modal de acceso de líder.');
        setStep('error');
      });
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (password.length < 4) return setFormError('Mínimo 4 caracteres.');
    if (password !== confirm) return setFormError('Las contraseñas no coinciden.');
    if (!user) return;
    setSaving(true);
    try {
      await createLeaderPassword(user.uid, password);
      setStep('done');
    } catch {
      setFormError('Error al guardar. Intenta de nuevo.');
      setSaving(false);
    }
  };

  if (step === 'checking') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </main>
    );
  }

  if (step === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-2">No se pudo verificar</p>
          <p className="text-xs text-gray-500 mb-6">{errorMsg}</p>
          <button onClick={() => router.push('/')}
            className="w-full px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Ir al inicio
          </button>
        </div>
      </main>
    );
  }

  if (step === 'done') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">¡Contraseña actualizada!</p>
          <p className="text-xs text-gray-400 mb-6">Ya puedes usar tu nueva contraseña para acceder al panel de líder.</p>
          <button onClick={() => router.push('/')}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors">
            Ir al inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-8">
        <div className="mb-6">
          <h1 className="text-base font-semibold text-gray-900">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-gray-500">Elige una nueva contraseña para el acceso de líder.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
              placeholder="Mínimo 4 caracteres"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
              placeholder="Repite la contraseña"
            />
          </div>

          {formError && <p className="text-xs text-red-500">{formError}</p>}

          <button type="submit" disabled={saving}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </main>
  );
}
