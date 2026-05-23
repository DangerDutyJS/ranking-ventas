'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';

interface AsesorFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function comprimirImagen(file: File, maxSize = 150): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d')!;
        const size = Math.min(img.width, img.height);
        const x = (img.width - size) / 2;
        const y = (img.height - size) / 2;
        ctx.drawImage(img, x, y, size, size, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export default function AsesorForm({ onSuccess, onCancel }: AsesorFormProps) {
  const storeId = useStoreId();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [cargo, setCargo] = useState('');
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await comprimirImagen(file);
    setFotoBase64(base64);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!nombre.trim() || !apellido.trim() || !cargo.trim()) {
      return setError('Todos los campos son obligatorios.');
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'tiendas', storeId, 'asesores'), {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        cargo: cargo.trim(),
        fotoBase64: fotoBase64 ?? '',
        creadoEn: serverTimestamp(),
      });
      onSuccess();
    } catch {
      setError('Error al guardar el asesor. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full">
      <h2 className="text-base font-semibold text-gray-900 mb-6">Registrar asesor</h2>

      <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">

        {/* Foto */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden hover:border-gray-400 transition-colors bg-gray-50"
          >
            {fotoBase64 ? (
              <Image src={fotoBase64} alt="preview" width={80} height={80} className="w-full h-full object-cover rounded-full" />
            ) : (
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
          <span className="text-xs text-gray-400">{fotoBase64 ? 'Cambiar foto' : 'Agregar foto (opcional)'}</span>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
        </div>

        {/* Nombre */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
            placeholder="Ej. Carlos"
          />
        </div>

        {/* Apellido */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label>
          <input
            type="text"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
            placeholder="Ej. Rodríguez"
          />
        </div>

        {/* Cargo */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cargo</label>
          <input
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-colors text-gray-900"
            placeholder="Ej. Asesor Senior"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
            {loading ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
