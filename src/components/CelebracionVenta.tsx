'use client';

interface Props {
  nombre: string;
  label: string;
  onDone: () => void;
}

export default function CelebracionVenta({ nombre, label, onDone }: Props) {
  return (
    <>
      <p role="status" className="sr-only">{`${label}: ${nombre}`}</p>
      <div className="fixed top-20 inset-x-4 sm:inset-x-auto sm:right-6 z-[60] flex justify-center sm:justify-end pointer-events-none" aria-hidden="true">
        <div
          className="animate-celebracion flex items-center gap-3 max-w-[300px] pl-2 pr-4 py-2 rounded-xl bg-[#003B6D] ring-1 ring-[#C79F4B]/50 shadow-[0_12px_32px_-8px_rgba(0,40,75,0.45)]"
          onAnimationEnd={(e) => { if (e.target === e.currentTarget) onDone(); }}
        >
          <span className="animate-celebracion-pop flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-[#D9B562] to-[#C79F4B] text-[#00284B] flex items-center justify-center">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
              <path d="M7 6H4.5a.5.5 0 0 0-.5.5V8a3 3 0 0 0 3 3M17 6h2.5a.5.5 0 0 1 .5.5V8a3 3 0 0 1-3 3" />
            </svg>
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[12px] font-semibold text-[#E3C27E] truncate">{label}</span>
            <span className="block text-[13px] font-medium text-white truncate">{nombre}</span>
          </span>
        </div>
      </div>
    </>
  );
}
