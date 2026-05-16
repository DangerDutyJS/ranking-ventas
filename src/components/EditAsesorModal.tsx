'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  cargo: string;
  fotoBase64: string;
}

interface EditAsesorModalProps {
  asesor: Asesor;
  onClose: () => void;
}

function comprimirImagen(file: File, maxSize = 150): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
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
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function EditAsesorModal({ asesor, onClose }: EditAsesorModalProps) {
  const storeId = useStoreId();
  const [nombre, setNombre] = useState(asesor.nombre);
  const [apellido, setApellido] = useState(asesor.apellido);
  const [cargo, setCargo] = useState(asesor.cargo);
  const [fotoBase64, setFotoBase64] = useState<string>(asesor.fotoBase64);
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
      await updateDoc(doc(db, 'tiendas', storeId, 'asesores', asesor.id), {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        cargo: cargo.trim(),
        fotoBase64,
      });
      onClose();
    } catch {
      setError('Error al actualizar. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 w-full max-w-md">
        <h2 className="text-base font-semibold text-gray-900 mb-6">Editar asesor</h2>

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
                <span className="text-2xl font-semibold text-gray-300">
                  {nombre[0]}{apellido[0]}
                </span>
              )}
            </button>
            <span className="text-xs text-gray-400">Cambiar foto</span>
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
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
