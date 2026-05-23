'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStoreId } from '@/context/StoreContext';

interface Notificacion {
  id: string;
  asesorId: string;
  asesorNombre: string;
  descripcion: string;
  creadoEn: { toDate: () => Date } | null;
}

const STORAGE_KEY = 'notif-vistas';

function tiempoRelativo(ts: Notificacion['creadoEn']): string {
  if (!ts?.toDate) return '';
  const diff = Date.now() - ts.toDate().getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${Math.floor(h / 24)}d`;
}

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function NotificacionesPanel() {
  const storeId = useStoreId();
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [open, setOpen] = useState(false);
  // timestamp until which everything is considered "leído"
  const [vistoHasta, setVistoHasta] = useState(() =>
    parseInt(typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) ?? '0') : '0')
  );
  // snapshot of vistoHasta taken when panel opens, for highlighting "new" items
  const [highlightHasta, setHighlightHasta] = useState(0);

  useEffect(() => {
    if (!storeId) return;
    const q = query(
      collection(db, 'tiendas', storeId, 'notificaciones'),
      orderBy('creadoEn', 'desc'),
      limit(50),
    );
    return onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notificacion)));
    });
  }, [storeId]);

  const unreadCount = notifs.filter((n) => {
    const ts = n.creadoEn?.toDate?.()?.getTime?.() ?? 0;
    return ts > vistoHasta;
  }).length;

  const handleOpen = () => {
    setHighlightHasta(vistoHasta); // captura qué era "nuevo" antes de marcar como leído
    setOpen(true);
    const now = Date.now();
    setVistoHasta(now);
    localStorage.setItem(STORAGE_KEY, String(now));
  };

  const handleClose = () => setOpen(false);

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative inline-flex items-center justify-center w-8 h-8 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        aria-label="Notificaciones"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay click-away */}
          <div className="flex-1 bg-black/20" onClick={handleClose} />

          {/* Panel */}
          <div className="w-full max-w-sm bg-white shadow-xl flex flex-col h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Notificaciones</h2>
                {unreadCount === 0 && notifs.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">Todo al día</p>
                )}
              </div>
              <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-50">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">Sin notificaciones aún.</p>
                </div>
              ) : (
                notifs.map((n) => {
                  const ts = n.creadoEn?.toDate?.()?.getTime?.() ?? 0;
                  const isNew = ts > highlightHasta;
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-5 py-4 transition-colors ${isNew ? 'bg-blue-50/60' : 'bg-white'}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-600">
                        {iniciales(n.asesorNombre)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 leading-tight">{n.asesorNombre}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.descripcion}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{tiempoRelativo(n.creadoEn)}</p>
                      </div>
                      {isNew && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
