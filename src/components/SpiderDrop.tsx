'use client';

interface Props {
  nombre: string;
  label: string;
  onDone: () => void;
}

export default function SpiderDrop({ nombre, label, onDone }: Props) {
  return (
    <>
      <p role="status" className="sr-only">{`${label}: ${nombre}`}</p>
      <div className="fixed top-0 right-6 sm:right-[8%] z-[60] pointer-events-none" aria-hidden="true">
        <div className="animate-spider-drop" onAnimationEnd={(e) => { if (e.target === e.currentTarget) onDone(); }}>
          <div className="animate-spider-sway flex flex-col items-center">
            <div className="w-px h-[400px] -mt-[400px] bg-gradient-to-b from-transparent via-white/30 to-white/50" />
            <svg className="w-11 h-11 -mt-1 text-[#ead9f5] drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)]" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M15 17 9 12 4 14M15 20H7l-4 3M15 23l-6 4-2 6M16 26l-4 6M25 17l6-5 5 2M25 20h8l4 3M25 23l6 4 2 6M24 26l4 6" />
              <ellipse cx="20" cy="15" rx="4" ry="3.5" fill="currentColor" stroke="none" />
              <ellipse cx="20" cy="23" rx="6" ry="7" fill="currentColor" stroke="none" />
              <circle cx="18.4" cy="14.4" r="0.9" fill="#fb923c" stroke="none" />
              <circle cx="21.6" cy="14.4" r="0.9" fill="#fb923c" stroke="none" />
            </svg>
            <div className="mt-1 max-w-[180px] px-2.5 py-1 rounded-md bg-[#241733] ring-1 ring-orange-400/40 text-[#fed7aa] text-[11px] font-semibold leading-tight text-center shadow-[0_4px_12px_rgba(36,23,51,0.3)]">
              {label}
              <span className="block font-medium text-white/80 truncate">{nombre}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
