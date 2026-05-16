'use client';

import { useState } from 'react';

// ─── Mini-mockups visuales ────────────────────────────────────────────────────

function Ping() {
  return (
    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
    </span>
  );
}

function MockupBienvenida() {
  return (
    <div className="space-y-1.5 w-full">
      {[
        { medal: '🥇', color: 'bg-green-400', w: 'w-full',  badge: '¡Meta cumplida!',  bc: 'text-green-700 bg-green-100' },
        { medal: '🥈', color: 'bg-blue-400',  w: 'w-2/3',   badge: '¡Casi lo logras!', bc: 'text-blue-700 bg-blue-100' },
        { medal: '🥉', color: 'bg-amber-400', w: 'w-1/3',   badge: '¡Buen ritmo!',     bc: 'text-amber-700 bg-amber-100' },
      ].map(({ medal, color, w, badge, bc }, i) => (
        <div key={i} className="bg-white rounded-xl px-3 py-2 border border-gray-100 flex items-center gap-2">
          <span>{medal}</span>
          <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-1.5 bg-gray-200 rounded mb-1.5 w-3/4" />
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className={`${color} h-1.5 rounded-full ${w} transition-all`} />
            </div>
          </div>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${bc}`}>{badge}</span>
        </div>
      ))}
    </div>
  );
}

function MockupLider() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden w-full">
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gray-900" />
          <div className="h-2 w-20 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-gray-200" />
          <div className="h-5 w-14 bg-gray-100 rounded-lg" />
          {/* Botón Líder destacado */}
          <div className="relative">
            <div className="h-6 px-2.5 bg-white border-2 border-gray-900 rounded-lg flex items-center gap-1 shadow-sm">
              <svg className="w-2.5 h-2.5 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-[9px] font-semibold text-gray-900">Líder</span>
            </div>
            <Ping />
          </div>
        </div>
      </div>
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-end">
        <div className="flex items-center gap-1 text-[9px] text-gray-500 font-medium">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          Toca este botón
        </div>
      </div>
    </div>
  );
}

function MockupAsesores() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden w-full">
      {/* Tabs */}
      <div className="flex items-center border-b border-gray-100 px-3">
        <div className="py-2 text-[10px] font-semibold text-gray-900 border-b-2 border-gray-900 mr-4">Asesores</div>
        <div className="py-2 text-[10px] text-gray-400">Meta del mes</div>
        <div className="ml-auto py-1.5">
          <div className="relative">
            <div className="bg-gray-900 text-white text-[9px] font-medium px-2 py-1 rounded-lg flex items-center gap-1 ring-2 ring-gray-900 ring-offset-1">
              <span>+</span>
              <span>Nuevo asesor</span>
            </div>
            <Ping />
          </div>
        </div>
      </div>
      {/* Mini form */}
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-[8px] text-gray-400 mb-0.5">Nombre *</div>
            <div className="h-6 border border-gray-200 rounded-lg bg-gray-50 px-2 flex items-center">
              <div className="h-1.5 w-10 bg-gray-200 rounded-full" />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[8px] text-gray-400 mb-0.5">Apellido *</div>
            <div className="h-6 border border-gray-200 rounded-lg bg-gray-50" />
          </div>
        </div>
        <div>
          <div className="text-[8px] text-gray-400 mb-0.5">Cargo</div>
          <div className="h-6 border border-gray-200 rounded-lg bg-gray-50" />
        </div>
        <div>
          <div className="text-[8px] text-gray-400 mb-0.5">Foto</div>
          <div className="h-7 border border-dashed border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center gap-1">
            <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[8px] text-gray-300">Subir foto del asesor</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockupPin() {
  return (
    <div className="w-full space-y-1.5">
      {[
        { nombre: 'Ana García', cargo: 'Asesora', tienePin: true },
        { nombre: 'Carlos López', cargo: 'Asesor', tienePin: false },
      ].map(({ nombre, cargo, tienePin }, i) => (
        <div key={i} className="bg-white rounded-xl px-3 py-2 border border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-[9px] font-semibold text-gray-400">{nombre[0]}G</span>
            </div>
            <div>
              <p className="text-[9px] font-semibold text-gray-900">{nombre}</p>
              <p className="text-[8px] text-gray-400">{cargo}</p>
            </div>
          </div>
          <div className="relative">
            <div className={`text-[9px] px-2 py-1 rounded-lg border font-medium ${
              tienePin
                ? 'border-green-200 text-green-700 bg-green-50'
                : 'border-gray-900 text-gray-900 bg-white ring-2 ring-gray-900 ring-offset-1'
            }`}>
              {tienePin ? 'PIN ✓' : 'Asignar PIN'}
            </div>
            {!tienePin && <Ping />}
          </div>
        </div>
      ))}
      <div className="flex justify-end pr-1">
        <span className="text-[9px] text-gray-400 flex items-center gap-1">
          Toca para asignar
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}

function MockupMeta() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden w-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-3">
        <div className="py-2 text-[10px] text-gray-400 mr-4">Asesores</div>
        <div className="py-2 text-[10px] font-semibold text-gray-900 border-b-2 border-gray-900">Meta del mes</div>
      </div>
      <div className="p-3 space-y-2">
        {/* Monto total */}
        <div>
          <div className="text-[8px] text-gray-500 mb-0.5">Monto total del mes *</div>
          <div className="relative">
            <div className="h-7 border-2 border-gray-900 rounded-xl bg-gray-50 flex items-center px-2">
              <span className="text-[9px] text-gray-400">Ej. 50.000.000</span>
            </div>
            <Ping />
          </div>
        </div>
        {/* Días por asesor */}
        <div>
          <div className="text-[8px] text-gray-500 mb-1">Días laborados por asesor *</div>
          <div className="space-y-1">
            {['Ana García', 'Carlos López'].map((n, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                <span className="text-[9px] text-gray-700">{n}</span>
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <div className="h-5 w-8 border-2 border-gray-900 rounded-md bg-white flex items-center justify-center">
                      <span className="text-[8px] text-gray-400">{i === 0 ? '22' : ''}</span>
                    </div>
                    {i === 1 && <Ping />}
                  </div>
                  <span className="text-[8px] text-gray-400">días</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MockupVentas() {
  return (
    <div className="flex items-center gap-2 w-full">
      {/* Tarjeta ranking */}
      <div className="flex-1 relative">
        <div className="bg-amber-50 border-2 border-gray-900 rounded-xl p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">🥇</span>
            <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-1.5 bg-gray-300 rounded mb-1 w-3/4" />
              <div className="h-1 bg-gray-100 rounded-full">
                <div className="h-1 bg-green-400 rounded-full w-4/5" />
              </div>
            </div>
          </div>
          <div className="text-[8px] text-gray-500 text-center font-medium">Toca tu tarjeta</div>
        </div>
        <Ping />
      </div>

      {/* Flecha */}
      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>

      {/* Modal PIN mini */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-2">
        <div className="w-8 h-8 rounded-full bg-gray-100 mx-auto mb-1.5" />
        <div className="text-[8px] text-gray-500 text-center mb-1.5">Ingresa tu PIN</div>
        <div className="h-6 border-2 border-gray-900 rounded-lg flex items-center justify-center mb-1.5">
          <span className="text-[10px] tracking-[0.3em] text-gray-400">••••</span>
        </div>
        <div>
          <div className="text-[8px] text-gray-400 mb-0.5">Venta de hoy</div>
          <div className="relative">
            <div className="h-5 border-2 border-gray-900 rounded-lg px-1.5 flex items-center">
              <span className="text-[8px] text-gray-400">2.500.000</span>
            </div>
            <Ping />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pasos ───────────────────────────────────────────────────────────────────

const PASOS = [
  {
    mockup: <MockupBienvenida />,
    titulo: '¡Bienvenido a Ranking Ventas!',
    descripcion: 'Aquí verás en tiempo real quién va primero, cuánto ha vendido cada asesor y cuánto falta para cumplir la meta del mes.',
    tip: null,
  },
  {
    mockup: <MockupLider />,
    titulo: 'Accede como líder',
    descripcion: 'Toca el botón "Líder" en la esquina superior derecha. La primera vez crearás una contraseña para proteger la configuración del equipo.',
    tip: 'Solo tú conoces esta contraseña. Los asesores no pueden ingresar al panel de configuración.',
  },
  {
    mockup: <MockupAsesores />,
    titulo: 'Registra a tus asesores',
    descripcion: 'Desde el panel líder, toca "+ Nuevo asesor" y completa el nombre, cargo y foto de cada miembro del equipo.',
    tip: 'La foto aparece en las tarjetas del ranking. Puedes agregar asesores en cualquier momento.',
  },
  {
    mockup: <MockupPin />,
    titulo: 'Asigna un PIN a cada asesor',
    descripcion: 'En la lista de asesores toca "Asignar PIN" y define un código de 4 dígitos. Cada asesor usará ese PIN para registrar sus ventas del día.',
    tip: 'Si un asesor olvida su PIN, puedes cambiarlo desde aquí cuando quieras.',
  },
  {
    mockup: <MockupMeta />,
    titulo: 'Configura la meta del mes',
    descripcion: 'En la pestaña "Meta del mes" ingresa el monto total a vender y los días que trabajará cada asesor. El sistema calcula la meta diaria solo.',
    tip: 'Editar la meta no borra las ventas ya registradas.',
  },
  {
    mockup: <MockupVentas />,
    titulo: 'Los asesores registran sus ventas',
    descripcion: 'Cada asesor toca su tarjeta en el ranking, ingresa su PIN de 4 dígitos y escribe el monto vendido. El ranking se actualiza al instante.',
    tip: '¡Pon la pantalla del ranking en una TV o tablet para que todo el equipo lo vea y se motive!',
  },
];

// ─── Componente principal ────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function TutorialModal({ onClose }: Props) {
  const [paso, setPaso] = useState(0);
  const total = PASOS.length;
  const { mockup, titulo, descripcion, tip } = PASOS[paso];
  const esFinal = paso === total - 1;

  const handleClose = () => {
    localStorage.setItem('tutorial-visto', '1');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

        {/* Barra de progreso */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-gray-900 transition-all duration-300"
            style={{ width: `${((paso + 1) / total) * 100}%` }}
          />
        </div>

        {/* Mockup visual */}
        <div className="bg-gray-50 border-b border-gray-100 px-5 py-4">
          {mockup}
        </div>

        {/* Contenido */}
        <div className="px-6 pt-5 pb-6">
          <p className="text-xs text-gray-400 mb-2">Paso {paso + 1} de {total}</p>
          <h2 className="text-sm font-semibold text-gray-900 mb-1.5">{titulo}</h2>
          <p className="text-xs text-gray-500 leading-relaxed">{descripcion}</p>

          {tip && (
            <div className="mt-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Tip: </span>{tip}
              </p>
            </div>
          )}

          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5 mt-5 mb-4">
            {PASOS.map((_, i) => (
              <button
                key={i}
                onClick={() => setPaso(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === paso ? 'w-5 h-1.5 bg-gray-900' : 'w-1.5 h-1.5 bg-gray-200 hover:bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            {paso === 0 ? (
              <button onClick={handleClose} className="px-4 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Omitir
              </button>
            ) : (
              <button onClick={() => setPaso(paso - 1)}
                className="px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Atrás
              </button>
            )}
            <button
              onClick={esFinal ? handleClose : () => setPaso(paso + 1)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors">
              {esFinal ? '¡Empezar!' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
