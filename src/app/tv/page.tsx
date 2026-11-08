'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { calcularMetas } from '@/lib/calcularMetas';
import { totalReal, barColor, type ConfigRanking } from '@/lib/reglas';
import { calcularScores, ordenarPorScore, posicionesPorScore, useConfigRanking, type TotalesAsesor } from '@/lib/ranking';
import ChipsMotivacion from '@/components/ChipsMotivacion';
import {
  calcularRacha, calcularInsignias, mayorProgresoSemana, mejorMesAnterior, minimoRecord, hitoEquipoCruzado,
  minutosRestantes, formatoRestante, restarDias, diaSemana, type DocVentas,
} from '@/lib/motivacion';

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  cargo: string;
  fotoBase64: string;
}

interface Meta {
  montoTotal: number;
  asesores: Record<string, { diasLaborados: number }>;
  metasPorDia?: Record<string, { asesoresIds?: string[] }>;
  metaTransacciones?: number;
  metaUnidades?: number;
  metaUPT?: number;
  metaAVT?: number;
}

interface Aplauso {
  id: string;
  asesorId: string;
  mensaje: string;
  fecha: string;
  creadoEn?: { seconds: number } | null;
}

interface Dinamica {
  id: string;
  nombre: string;
  meta: number;
  fecha: string;
  activa: boolean;
  asesoresIds: string[];
  progreso?: Record<string, number>;
  horaLimite?: string;
}

const FRASES = [
  'Cada venta te acerca al siguiente nivel',
  'El cliente de hoy es el récord de mañana',
  'Constancia diaria, resultados de mes',
  'Una venta más marca la diferencia',
  'El ranking se gana venta a venta',
  'Hoy es un buen día para superar tu marca',
  'Las metas grandes se logran en equipo',
];
const MEDALS = ['🥇', '🥈', '🥉'];
const ROTACION_MS = 15000;

function mesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function Avatar({ a, size }: { a: Asesor; size: number }) {
  return (
    <div className="rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ width: size, height: size }}>
      {a.fotoBase64
        ? <Image src={a.fotoBase64} alt="" width={size} height={size} className="w-full h-full object-cover" />
        : <span className="font-semibold text-gray-400" style={{ fontSize: size * 0.36 }}>{a.nombre[0]}{a.apellido?.[0]}</span>}
    </div>
  );
}

export default function TvPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const mes = mesActual();

  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [docs, setDocs] = useState<DocVentas[]>([]);
  const [aplausos, setAplausos] = useState<Aplauso[]>([]);
  const [dinamicas, setDinamicas] = useState<Dinamica[]>([]);
  const [ahora, setAhora] = useState(() => new Date());
  const [slide, setSlide] = useState(0);
  const [celebracion, setCelebracion] = useState<{ id: number; titulo: string; nombre: string; asesorId?: string } | null>(null);

  const metaTotalRef = useRef(0);
  const cfgRanking = useConfigRanking(user?.uid);
  // Contexto para calcular posiciones por puntaje dentro del onSnapshot sin re-suscribirse.
  const scoreCtxRef = useRef<{ ids: string[]; meta: Meta | null; cfg: ConfigRanking }>({ ids: [], meta: null, cfg: cfgRanking });
  useEffect(() => {
    scoreCtxRef.current = { ids: asesores.map((a) => a.id), meta, cfg: cfgRanking };
  }, [asesores, meta, cfgRanking]);
  const prevRef = useRef<{ registros: Record<string, number>; pos: Record<string, number>; pct: number | null } | null>(null);
  const ultimoMapRef = useRef<Record<string, TotalesAsesor> | null>(null);
  // Recalcula la línea base de posiciones si meta/config/asesores llegan después del primer snapshot de ventas.
  useEffect(() => {
    if (!prevRef.current || !ultimoMapRef.current) return;
    prevRef.current = { ...prevRef.current, pos: posicionesPorScore(asesores.map((a) => a.id), ultimoMapRef.current, meta, cfgRanking) };
  }, [asesores, meta, cfgRanking]);
  const prevAplausosRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Mantiene la pantalla encendida en la TV/tablet de la tienda (si el navegador lo permite).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        if (nav.wakeLock && document.visibilityState === 'visible') lock = await nav.wakeLock.request('screen');
      } catch { /* no soportado o denegado */ }
    };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => {
      document.removeEventListener('visibilitychange', pedir);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const unsubs = [
      onSnapshot(query(collection(db, 'tiendas', uid, 'asesores'), orderBy('creadoEn', 'asc')), (snap) => {
        setAsesores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asesor)));
      }),
      onSnapshot(doc(db, 'tiendas', uid, 'metas', mes), (snap) => {
        const m = snap.exists() ? (snap.data() as Meta) : null;
        setMeta(m);
        metaTotalRef.current = m?.montoTotal ?? 0;
      }),
      onSnapshot(query(collection(db, 'tiendas', uid, 'dinamicas'), where('fecha', '==', new Date().toLocaleDateString('fr-CA'))), (snap) => {
        setDinamicas(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Dinamica)).filter((d) => d.activa));
      }),
      onSnapshot(collection(db, 'tiendas', uid, 'ventasMes'), (snap) => {
        const todos = snap.docs.map((d) => d.data() as DocVentas);
        setDocs(todos);
        const delMes = todos.filter((d) => d.mes === mes);
        const registros: Record<string, number> = {};
        delMes.forEach((d) => { registros[d.asesorId] = d.registros?.length ?? 0; });
        const ctx = scoreCtxRef.current;
        const mapMes: Record<string, TotalesAsesor> = {};
        delMes.forEach((d) => { mapMes[d.asesorId] = d as TotalesAsesor; });
        const pos = posicionesPorScore(ctx.ids, mapMes, ctx.meta, ctx.cfg);
        ultimoMapRef.current = mapMes;
        const metaTotal = metaTotalRef.current;
        const pct = metaTotal > 0 ? (delMes.reduce((s, d) => s + totalReal(d), 0) / metaTotal) * 100 : null;

        const prev = prevRef.current;
        prevRef.current = { registros, pos, pct };
        if (!prev) return;
        for (const id of Object.keys(registros)) {
          const subio = prev.pos[id] !== undefined && pos[id] < prev.pos[id];
          if (subio) setCelebracion({ id: Date.now(), titulo: `¡Subió al ${pos[id] + 1}º lugar!`, nombre: '', asesorId: id });
          else if (registros[id] > (prev.registros[id] ?? 0)) setCelebracion({ id: Date.now(), titulo: '¡Nueva venta!', nombre: '', asesorId: id });
        }
        if (prev.pct !== null && pct !== null) {
          const hito = hitoEquipoCruzado(prev.pct, pct);
          if (hito !== null) setCelebracion({ id: Date.now(), titulo: hito >= 100 ? '¡Meta del equipo cumplida! 🎉' : `¡El equipo llegó al ${hito}%!`, nombre: 'Todo el equipo' });
        }
      }),
      onSnapshot(query(collection(db, 'tiendas', uid, 'aplausos'), where('fecha', '>=', restarDias(new Date().toLocaleDateString('fr-CA'), 6))), (snap) => {
        const lista = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Aplauso))
          .sort((a, b) => (b.creadoEn?.seconds ?? Number.MAX_SAFE_INTEGER) - (a.creadoEn?.seconds ?? Number.MAX_SAFE_INTEGER));
        setAplausos(lista);
        const prev = prevAplausosRef.current;
        prevAplausosRef.current = new Set(lista.map((a) => a.id));
        if (!prev) return;
        const nuevo = lista.find((a) => !prev.has(a.id));
        if (nuevo) setCelebracion({ id: Date.now(), titulo: `👏 ${nuevo.mensaje}`, nombre: '', asesorId: nuevo.asesorId });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user, mes]);

  const hoy = ahora.toLocaleDateString('fr-CA');
  const aplausosVisibles = aplausos.filter((ap) => asesores.some((a) => a.id === ap.asesorId)).slice(0, 4);
  const slides = ['ranking', 'logros', ...(aplausosVisibles.length ? ['aplausos'] : [])] as const;
  const totalSlides = slides.length;

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % totalSlides), ROTACION_MS);
    return () => clearInterval(t);
  }, [totalSlides]);

  if (loading || !user) return null;

  const ventasMap: Record<string, DocVentas> = {};
  docs.filter((d) => d.mes === mes).forEach((d) => { ventasMap[d.asesorId] = d; });
  // Mismo orden que el ranking mensual del dashboard: puntaje ponderado, desempate por dinero.
  const scores = calcularScores(asesores.map((a) => a.id), ventasMap as Record<string, TotalesAsesor>, meta, cfgRanking);
  const ranking = ordenarPorScore(asesores.map((a) => a.id), scores).map((id) => asesores.find((a) => a.id === id)!);
  const metasMap = meta && asesores.length > 0 ? calcularMetas(meta.montoTotal, asesores.map((a) => a.id), meta.asesores) : {};

  const insignias = calcularInsignias(docs.filter((d) => d.mes === mes), hoy);
  const progreso = mayorProgresoSemana(docs, hoy);
  const logros = asesores.map((a) => {
    const noTrabaja = (f: string) => {
      if (f.slice(0, 7) !== mes) return false;
      const ids = meta?.metasPorDia?.[String(diaSemana(f))]?.asesoresIds;
      return !!ids?.length && !ids.includes(a.id);
    };
    const mejor = mejorMesAnterior(docs, a.id, mes, minimoRecord(metasMap[a.id]?.metaMensual ?? 0));
    const total = totalReal(ventasMap[a.id]);
    return {
      asesor: a,
      racha: calcularRacha(a.id, docs, hoy, noTrabaja),
      sobreRecord: mejor && total > mejor.total ? (total / mejor.total - 1) * 100 : null,
    };
  });
  const logroDe = (id: string) => logros.find((l) => l.asesor.id === id);

  const totalEquipo = asesores.reduce((s, a) => s + totalReal(ventasMap[a.id]), 0);
  const pctEquipo = meta && meta.montoTotal > 0 ? (totalEquipo / meta.montoTotal) * 100 : 0;
  const daysInMonth = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
  const diasRestantes = Math.max(1, daysInMonth - ahora.getDate() + 1);
  const faltaEquipo = meta ? Math.max(0, meta.montoTotal - totalEquipo) : 0;
  const frase = FRASES[(ahora.getDate() - 1) % FRASES.length];
  const mesNombre = ahora.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const retos = dinamicas.filter((d) => d.horaLimite && minutosRestantes(d.fecha, d.horaLimite, ahora) > 0);

  const actual = slides[slide % totalSlides];
  const nombreCompleto = (id?: string) => {
    const a = asesores.find((x) => x.id === id);
    return a ? `${a.nombre} ${a.apellido ?? ''}`.trim() : '';
  };

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <main className="theme-dark min-h-screen bg-dot-grid relative isolate flex flex-col">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#003B6D] via-[#003B6D] to-[#C79F4B]" />
      <header className="flex items-center justify-between gap-4 px-6 lg:px-10 pt-6 pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-4xl font-bold tracking-tight text-heading">Ranking de Ventas <span aria-hidden="true">🏆</span></h1>
          <p className="text-sm lg:text-lg text-accent-muted mt-0.5"><span className="capitalize">{mesNombre}</span> · {frase}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden sm:block text-2xl lg:text-3xl font-semibold tabular-nums text-heading mr-2">
            {ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={pantallaCompleta} className="text-[12px] font-medium text-accent-text border border-gold/50 px-3 h-8 rounded-md hover:bg-gold-light transition-colors">
            Pantalla completa
          </button>
          <button onClick={() => router.push('/')} className="text-[12px] text-gray-400 hover:text-gray-900 px-2 h-8 transition-colors">Salir</button>
        </div>
      </header>

      <div className="flex-1 grid gap-6 px-6 lg:px-10 pb-8 lg:grid-cols-3 min-h-0">
        {/* Panel rotativo */}
        <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-surface p-5 lg:p-7 flex flex-col min-h-0" aria-live="off">
          <div key={actual} className="animate-fade-in flex-1 min-h-0">
            {actual === 'ranking' && (
              <>
                <h2 className="text-xl lg:text-2xl font-bold text-heading mb-4">Ranking mensual</h2>
                <ol className="space-y-2.5">
                  {ranking.slice(0, 8).map((a, i) => {
                    const total = totalReal(ventasMap[a.id]);
                    const metaA = metasMap[a.id]?.metaMensual ?? 0;
                    const pct = scores[a.id]?.score ?? (metaA > 0 ? (total / metaA) * 100 : 0);
                    const l = logroDe(a.id);
                    return (
                      <li key={a.id} className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${i === 0 ? 'border-gold/70 bg-gradient-to-r from-gold-light to-surface' : 'border-gray-100'}`}>
                        <span className="w-10 text-center text-2xl lg:text-3xl flex-shrink-0">{i < 3 ? MEDALS[i] : <span className="text-lg font-semibold text-gray-400">#{i + 1}</span>}</span>
                        <Avatar a={a} size={52} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-lg lg:text-xl font-semibold text-heading truncate">{a.nombre} {a.apellido}</p>
                            <p className="text-lg lg:text-xl font-bold tabular-nums text-heading flex-shrink-0">{formatCurrency(total)}</p>
                          </div>
                          {scores[a.id]?.score != null && (
                            <p className="text-sm text-gray-500 tabular-nums">
                              <b className="text-gold-text">{scores[a.id].score!.toFixed(1)} pts</b>
                              {scores[a.id].rescate.puntos > 0 && <span> · 🛟 +{scores[a.id].rescate.puntos.toFixed(1)} rescate</span>}
                            </p>
                          )}
                          {metaA > 0 && (
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                                <div className={`h-full rounded-full transition-[width] duration-700 ${barColor(pct)}`} style={{ width: `${Math.min(120, pct) / 120 * 100}%` }} />
                              </div>
                              <span className="text-sm font-semibold tabular-nums text-gray-600 w-14 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          )}
                          {l && l.racha.dias >= 2 && (
                            <p className="text-[13px] text-gold-text mt-1">🔥 {l.racha.dias} días seguidos</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}

            {actual === 'logros' && (
              <>
                <h2 className="text-xl lg:text-2xl font-bold text-heading mb-1">Constancia y logros</h2>
                <p className="text-sm lg:text-base text-accent-muted mb-5">Quien registra todos los días, construye su racha 🔥</p>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {[...logros]
                    .sort((x, y) => y.racha.dias - x.racha.dias)
                    .map((l) => (
                      <li key={l.asesor.id} className="flex items-start gap-3 rounded-xl border border-gray-100 px-4 py-3">
                        <Avatar a={l.asesor} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="text-base lg:text-lg font-semibold text-heading truncate">{l.asesor.nombre}</p>
                          <ChipsMotivacion
                            className="mt-1.5"
                            size="lg"
                            racha={l.racha}
                            sobreRecord={l.sobreRecord}
                            insignias={insignias[l.asesor.id] ?? []}
                            mayorProgreso={progreso?.asesorId === l.asesor.id ? progreso.pct : null}
                          />
                          {l.racha.dias === 0 && !(insignias[l.asesor.id]?.length) && (
                            <p className="text-sm text-gray-400 mt-1">¡Hoy puede empezar su racha!</p>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              </>
            )}

            {actual === 'aplausos' && (
              <>
                <h2 className="text-xl lg:text-2xl font-bold text-heading mb-5"><span aria-hidden="true">👏</span> Reconocimientos de la líder</h2>
                <ul className="space-y-4">
                  {aplausosVisibles.map((ap) => {
                    const a = asesores.find((x) => x.id === ap.asesorId)!;
                    return (
                      <li key={ap.id} className="flex items-center gap-4 rounded-xl border border-gold/40 px-5 py-4">
                        <Avatar a={a} size={60} />
                        <div className="min-w-0">
                          <p className="text-xl lg:text-2xl font-semibold text-heading">{a.nombre} {a.apellido}</p>
                          <p className="text-base lg:text-xl text-gold-text mt-0.5 [text-wrap:pretty]">{ap.mensaje}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
          <div className="flex justify-center gap-2 pt-4" aria-hidden="true">
            {slides.map((s, i) => (
              <span key={s} className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${i === slide % totalSlides ? 'w-6 bg-gold' : 'w-1.5 bg-gray-300'}`} />
            ))}
          </div>
        </section>

        {/* Columna fija */}
        <aside className="space-y-6">
          {meta && meta.montoTotal > 0 && (
            <section className="rounded-2xl border border-gray-200 bg-surface p-5 lg:p-6">
              <p className="text-sm font-medium text-gold-text mb-1">Meta del equipo</p>
              <p className="text-5xl lg:text-6xl font-bold tabular-nums text-heading">{Math.round(pctEquipo)}%</p>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden mt-3">
                <div className={`h-full rounded-full transition-[width] duration-700 ${barColor(pctEquipo)}`} style={{ width: `${Math.min(100, pctEquipo)}%` }} />
              </div>
              <p className="text-sm lg:text-base text-gray-600 mt-3 tabular-nums">{formatCurrency(totalEquipo)} <span className="text-gray-400">de {formatCurrency(meta.montoTotal)}</span></p>
              <p className="text-sm lg:text-base text-gray-400 mt-1">
                {faltaEquipo > 0
                  ? <>Faltan <b className="text-gray-700 tabular-nums">{formatCurrency(faltaEquipo / diasRestantes)}</b> por día · {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}</>
                  : <span className="text-emerald-700 font-medium">¡Meta cumplida! Vamos por el 120%</span>}
              </p>
            </section>
          )}

          {retos.length > 0 && (
            <section className="rounded-2xl border border-gold/50 bg-surface p-5 lg:p-6">
              <p className="text-sm font-semibold text-gold-text mb-3"><span aria-hidden="true">⚡</span> Retos relámpago</p>
              <ul className="space-y-3">
                {retos.map((d) => {
                  const total = d.asesoresIds.reduce((s, id) => s + (d.progreso?.[id] ?? 0), 0);
                  const metaR = d.meta * (d.asesoresIds.length || 1);
                  return (
                    <li key={d.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-base lg:text-lg font-semibold text-heading truncate">{d.nombre}</span>
                        <span className="text-lg lg:text-xl font-bold tabular-nums text-amber-600 flex-shrink-0">{formatoRestante(minutosRestantes(d.fecha, d.horaLimite!, ahora))}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-1.5">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${metaR > 0 ? Math.min(100, (total / metaR) * 100) : 0}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 tabular-nums">{total} / {metaR}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {progreso && nombreCompleto(progreso.asesorId) && (
            <section className="rounded-2xl border border-gold/50 bg-surface p-5 lg:p-6">
              <p className="text-sm font-medium text-gold-text mb-2"><span aria-hidden="true">🚀</span> Mayor progreso de la semana</p>
              <p className="text-xl lg:text-2xl font-semibold text-heading">{nombreCompleto(progreso.asesorId)}</p>
              <p className="text-sm lg:text-base text-gray-400 mt-0.5">+{Math.round(progreso.pct)}% frente a la semana anterior</p>
            </section>
          )}
        </aside>
      </div>

      {celebracion && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[18vh] pointer-events-none" role="status">
          <div
            key={celebracion.id}
            className="animate-celebracion flex items-center gap-5 max-w-[min(90vw,720px)] px-8 py-6 rounded-3xl bg-[#003B6D] ring-2 ring-gold/60 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7)]"
            onAnimationEnd={(e) => { if (e.target === e.currentTarget) setCelebracion(null); }}
          >
            <span className="animate-celebracion-pop text-6xl lg:text-7xl flex-shrink-0" aria-hidden="true">🏆</span>
            <div className="min-w-0">
              <p className="text-2xl lg:text-4xl font-bold text-gold-text [text-wrap:balance]">{celebracion.titulo}</p>
              <p className="text-xl lg:text-3xl font-semibold text-white mt-1 truncate">{celebracion.nombre || nombreCompleto(celebracion.asesorId)}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
