'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

export interface MensajePlaca {
  icono: string;
  texto: string;
  tipo?: 'logro' | 'consejo';
}

export interface DatosPlaca {
  id: number;
  monto: number;
  titulo: string;
  frase: string;
  racha: number;
  pct: number | null;
  posicion: number | null;
  // Mensajes motivacionales (posición, racha, récord, ritmo, consejo) que se muestran dentro de la placa.
  mensajes?: MensajePlaca[];
}

interface Props {
  datos: DatosPlaca;
  asesor: { nombre: string; apellido: string; fotoBase64: string };
  onClose: () => void;
}

const DURACION_MS = 10000;

// Confeti determinista (sin Math.random en render): 24 piezas repartidas en abanico desde la medalla.
const CONFETI = Array.from({ length: 24 }, (_, i) => {
  const ang = ((i * 15 + (i % 3) * 7) * Math.PI) / 180;
  const dist = 90 + (i % 4) * 24;
  return {
    x: Math.round(Math.cos(ang) * dist),
    y: Math.round(Math.sin(ang) * dist * 0.75 - 24),
    r: (i % 2 ? 1 : -1) * (160 + i * 23),
    color: ['#C79F4B', '#E3C27E', '#003B6D', '#AD8736', '#6F95BC'][i % 5],
    redondo: i % 3 === 0,
    delay: (i % 5) * 18,
  };
});

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function prefiereSinMovimiento() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function PlacaReconocimiento({ datos, asesor, onClose }: Props) {
  const [valor, setValor] = useState(() => (prefiereSinMovimiento() ? datos.monto : 0));
  const cerrarRef = useRef(onClose);
  useEffect(() => { cerrarRef.current = onClose; }, [onClose]);

  // Contador del monto: ease-out en 800ms, arranca cuando la placa ya entró.
  useEffect(() => {
    if (prefiereSinMovimiento()) return;
    let raf = 0;
    const inicio = performance.now() + 250;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - inicio) / 800));
      setValor(Math.round(datos.monto * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [datos.monto]);

  useEffect(() => {
    const t = setTimeout(() => cerrarRef.current(), DURACION_MS);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, []);

  const stats = [
    datos.racha > 0 ? `🔥 ${datos.racha} ${datos.racha === 1 ? 'día' : 'días'}` : null,
    datos.pct !== null ? `${Math.round(datos.pct)}% cumplimiento` : null,
    datos.posicion !== null ? `${datos.posicion}º lugar` : null,
  ].filter((s): s is string => s !== null);

  // Portal a <body>: el modal de ventas tiene transform (animación de entrada), que convierte a ese modal en
  // el contenedor de los position:fixed hijos y encerraba la placa. .theme-light conserva la paleta.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="theme-light">
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-5 bg-[#00203D]/55 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="placa-titulo"
        aria-describedby="placa-frase"
        onClick={(e) => e.stopPropagation()}
        className="placa-in relative w-full max-w-[360px] max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] overflow-y-auto overscroll-contain rounded-3xl bg-surface border-2 border-gold shadow-[0_28px_70px_-18px_rgba(0,32,61,0.55)]"
      >
        <div className="relative h-24 bg-primary overflow-hidden">
          <div
            className="absolute inset-0 opacity-60"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(227,194,126,0.22) 1px, transparent 1px)', backgroundSize: '14px 14px' }}
            aria-hidden="true"
          />
          <p className="relative pt-4 text-center text-[10px] font-semibold tracking-[0.28em] text-[#E3C27E]">RECONOCIMIENTO</p>
          <span className="placa-brillo absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg]" aria-hidden="true" />
        </div>

        <div className="relative flex justify-center -mt-11">
          <div className="absolute top-10 left-1/2 w-0 h-0" aria-hidden="true">
            {CONFETI.map((c, i) => (
              <span
                key={i}
                className={`confeti absolute block ${c.redondo ? 'w-2.5 h-2.5 rounded-full' : 'w-2 h-3.5 rounded-[1px]'}`}
                style={{
                  backgroundColor: c.color,
                  ['--cx' as string]: `${c.x}px`,
                  ['--cy' as string]: `${c.y}px`,
                  ['--cr' as string]: `${c.r}deg`,
                  animationDelay: `${180 + c.delay}ms`,
                }}
              />
            ))}
          </div>
          <div className="medalla-pop relative w-[84px] h-[84px] rounded-full p-[3px] bg-gradient-to-br from-[#E3C27E] via-[#C79F4B] to-[#AD8736] shadow-[0_10px_24px_-6px_rgba(173,135,54,0.7)]">
            <div className="w-full h-full rounded-full bg-surface overflow-hidden flex items-center justify-center ring-2 ring-[#F9F4E8]">
              {asesor.fotoBase64
                ? <Image src={asesor.fotoBase64} alt="" width={78} height={78} className="w-full h-full object-cover" />
                : <span className="text-4xl" aria-hidden="true">🏅</span>}
            </div>
            <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gold text-[15px] flex items-center justify-center ring-2 ring-surface" aria-hidden="true">🏆</span>
          </div>
        </div>

        <div className="px-6 pt-3 pb-6 text-center">
          <h2 id="placa-titulo" className="placa-texto text-[22px] leading-tight font-bold tracking-tight text-heading [text-wrap:balance]" style={{ animationDelay: '220ms' }}>
            {datos.titulo}
          </h2>
          <p className="placa-texto mt-1 text-sm text-gray-500" style={{ animationDelay: '280ms' }}>
            {asesor.nombre} {asesor.apellido}
          </p>

          <p className="placa-texto mt-4 text-[32px] leading-none font-bold tabular-nums text-primary" style={{ animationDelay: '320ms' }}>
            <span className="text-gold" aria-hidden="true">+</span> {formatCurrency(valor)}
            <span className="sr-only">Venta registrada de {formatCurrency(datos.monto)}</span>
          </p>

          {stats.length > 0 && (
            <ul className="placa-texto mt-4 flex flex-wrap justify-center gap-1.5" style={{ animationDelay: '380ms' }}>
              {stats.map((s) => (
                <li key={s} className="text-[12px] font-medium px-2.5 py-1 rounded-full bg-gold-light text-gold-text border border-gold/40">{s}</li>
              ))}
            </ul>
          )}

          <p id="placa-frase" className="placa-texto mt-4 text-[13.5px] leading-snug text-gray-600 italic [text-wrap:pretty]" style={{ animationDelay: '440ms' }}>
            “{datos.frase}”
          </p>

          {datos.mensajes && datos.mensajes.length > 0 && (
            <ul className="placa-texto mt-4 space-y-2 text-left" style={{ animationDelay: '470ms' }}>
              {datos.mensajes.map((m, i) => (
                <li
                  key={i}
                  className={`flex gap-2.5 rounded-xl px-3 py-2 text-[12.5px] leading-snug [text-wrap:pretty] ${
                    m.tipo === 'consejo' ? 'bg-primary-light text-primary'
                      : m.tipo === 'logro' ? 'bg-gold-light text-gold-text font-medium'
                        : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <span aria-hidden="true" className="text-base leading-none">{m.icono}</span>
                  <span className="min-w-0">{m.texto}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="placa-texto mt-5 w-full h-11 rounded-xl bg-accent text-on-accent text-sm font-semibold hover:bg-accent-hover active:scale-[0.98] transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            style={{ animationDelay: '500ms' }}
          >
            ¡A seguir vendiendo!
          </button>
        </div>

        <div className="sticky bottom-0 h-1 bg-gold-light" aria-hidden="true">
          <div className="placa-timer h-full bg-gold origin-left" style={{ animationDuration: `${DURACION_MS}ms` }} />
        </div>
      </div>
    </div>
    </div>,
    document.body,
  );
}
