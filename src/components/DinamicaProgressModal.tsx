"use client";

import { useState } from "react";
import { doc, updateDoc, increment, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStoreId } from "@/context/StoreContext";

interface RegistroDinamica {
  cantidad: number;
  creadoEn: string;
}

interface Dinamica {
  id: string;
  nombre: string;
  meta: number;
  progreso: Record<string, number>;
  registros?: Record<string, RegistroDinamica[]>;
}

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
}

interface Props {
  dinamica: Dinamica;
  asesor: Asesor;
  onClose: () => void;
}

function formatHora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function DinamicaProgressModal({
  dinamica,
  asesor,
  onClose,
}: Props) {
  const storeId = useStoreId();
  const totalActual = dinamica.progreso?.[asesor.id] ?? 0;
  const historial: RegistroDinamica[] = [
    ...(dinamica.registros?.[asesor.id] ?? []),
  ].sort(
    (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
  );

  const [cantidad, setCantidad] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const cantidadNum = parseInt(cantidad, 10) || 0;
  const totalPreview = totalActual + cantidadNum;
  const pct =
    dinamica.meta > 0 ? Math.min(100, (totalPreview / dinamica.meta) * 100) : 0;
  const pctActual =
    dinamica.meta > 0 ? Math.min(100, (totalActual / dinamica.meta) * 100) : 0;

  const fillColor =
    pct >= 100
      ? "bg-gradient-to-r from-emerald-400 to-green-500"
      : pct >= 80
        ? "bg-gradient-to-r from-amber-400 to-yellow-400"
        : "bg-gradient-to-r from-rose-400 to-red-400";
  const pctColor =
    pct >= 100
      ? "text-emerald-600"
      : pct >= 80
        ? "text-amber-600"
        : "text-rose-600";

  async function handleSubmit() {
    const v = parseInt(cantidad, 10);
    if (isNaN(v) || v <= 0) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "tiendas", storeId, "dinamicas", dinamica.id), {
        [`progreso.${asesor.id}`]: increment(v),
        [`registros.${asesor.id}`]: arrayUnion({
          cantidad: v,
          creadoEn: new Date().toISOString(),
        }),
      });
      setSaved(true);
      setTimeout(onClose, 800);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                <h2 className="text-base font-semibold text-gray-900">
                  {dinamica.nombre}
                </h2>
              </div>
              <p className="text-sm text-gray-400">
                {asesor.nombre} {asesor.apellido}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Barra de progreso con preview */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400 tabular-nums">
                {cantidadNum > 0 ? (
                  <>
                    {totalActual}{" "}
                    <span className="text-violet-500">+{cantidadNum}</span> ={" "}
                    {totalPreview} / {dinamica.meta}
                  </>
                ) : (
                  <>
                    {totalActual} / {dinamica.meta}
                  </>
                )}
              </span>
              <span className={`font-semibold tabular-nums ${pctColor}`}>
                {pct.toFixed(0)}%
              </span>
            </div>
            <div className="relative w-full bg-gray-100 rounded-full h-2">
              {/* barra actual */}
              <div
                className="h-2 rounded-full bg-gray-300 transition-none absolute left-0"
                style={{ width: `${pctActual}%` }}
              />
              {/* preview con la nueva cantidad */}
              <div
                className={`h-2 rounded-full transition-all duration-300 absolute left-0 ${fillColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Historial */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Historial hoy
          </p>
          {historial.length > 0 ? (
            <div className="space-y-1">
              {historial.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                >
                  <span className="text-xs text-gray-400">
                    {formatHora(entry.creadoEn)}
                  </span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums">
                    +{entry.cantidad}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2.5">
                <span className="text-xs font-medium text-gray-500">
                  Total acumulado
                </span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">
                  {totalActual}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Sin registros hoy.
            </p>
          )}
        </div>

        {/* Input + botón */}
        <div className="px-6 py-5 border-t border-gray-100 flex-shrink-0 space-y-3">
          <div>
            <label className="block text-sm text-gray-500 mb-1.5">
              Agregar cantidad
            </label>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-3xl font-bold text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-900/20 tabular-nums"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <p className="text-xs text-gray-400 text-center mt-1.5">
              Meta: {dinamica.meta} unidades
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || saved || !cantidad || cantidadNum <= 0}
              className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-60 hover:bg-gray-700 transition-colors"
            >
              {saved ? "✓ Registrado" : saving ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
