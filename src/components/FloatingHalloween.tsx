'use client';

// mobile: false → solo en ≥sm, para no ensuciar pantallas chicas donde el ranking ocupa todo el ancho.
const ITEMS = [
  { icon: '🦇', left: '4%',  top: '14%', size: 18, delay: '0s',   duration: '9s',    mobile: true },
  { icon: '🎃', left: '10%', top: '70%', size: 16, delay: '2.4s', duration: '11s',   mobile: false },
  { icon: '👻', left: '24%', top: '34%', size: 18, delay: '1s',   duration: '10s',   mobile: false },
  { icon: '🕸️', left: '50%', top: '86%', size: 14, delay: '3.2s', duration: '12s',   mobile: true },
  { icon: '🦇', left: '80%', top: '24%', size: 20, delay: '1.6s', duration: '10.5s', mobile: true },
  { icon: '👻', left: '90%', top: '68%', size: 16, delay: '3.6s', duration: '11.5s', mobile: true },
  { icon: '🎃', left: '66%', top: '50%', size: 15, delay: '2s',   duration: '9.5s',  mobile: false },
];

export default function FloatingHalloween() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {ITEMS.map((h, i) => (
        <span
          key={i}
          className={`absolute animate-spooky-float select-none ${h.mobile ? '' : 'hidden sm:block'}`}
          style={{ left: h.left, top: h.top, fontSize: h.size, animationDelay: h.delay, animationDuration: h.duration }}
        >
          {h.icon}
        </span>
      ))}
    </div>
  );
}
