'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calcularMetas } from '@/lib/calcularMetas';
import {
  calcularScoreRanking, compararRanking, metasUptAvt, normalizarConfigRanking, totalReal,
  CONFIG_RANKING_DEFAULT, type ConfigRanking, type MetaIndicadores, type ScoreRanking,
} from '@/lib/reglas';

export interface TotalesAsesor {
  totalVentas?: number;
  totalUnidades?: number;
  totalTransacciones?: number;
  acumuladoMes?: { monto: number; unidades?: number; transacciones?: number };
}

export interface MetaRanking extends MetaIndicadores {
  asesores?: Record<string, { diasLaborados: number }>;
}

export type ScoreAsesor = ScoreRanking & { ventaReal: number; metaVenta: number };

// Puntaje de cada asesor del mes. metaVenta sale del mismo reparto por días laborados que usa el dashboard.
export function calcularScores(
  asesorIds: string[],
  ventas: Record<string, TotalesAsesor | undefined>,
  meta: MetaRanking | null | undefined,
  cfg: ConfigRanking,
): Record<string, ScoreAsesor> {
  const metasMap = meta && asesorIds.length > 0 ? calcularMetas(meta.montoTotal, asesorIds, meta.asesores ?? {}) : {};
  const { upt, avt } = metasUptAvt(meta);
  const res: Record<string, ScoreAsesor> = {};
  for (const id of asesorIds) {
    const vm = ventas[id];
    const ventaReal = totalReal(vm);
    const metaVenta = metasMap[id]?.metaMensual ?? 0;
    res[id] = {
      ...calcularScoreRanking({
        ventaReal,
        metaVenta,
        unidades: (vm?.totalUnidades ?? 0) + (vm?.acumuladoMes?.unidades ?? 0),
        transacciones: (vm?.totalTransacciones ?? 0) + (vm?.acumuladoMes?.transacciones ?? 0),
        metaUPT: upt,
        metaAVT: avt,
      }, cfg),
      ventaReal,
      metaVenta,
    };
  }
  return res;
}

export function ordenarPorScore(asesorIds: string[], scores: Record<string, ScoreAsesor>): string[] {
  return [...asesorIds].sort((a, b) => compararRanking(scores[a], scores[b]));
}

// Índice (0 = primero) de cada asesor en el ranking mensual. Usado para detectar "¡Subió al Nº lugar!".
export function posicionesPorScore(
  asesorIds: string[],
  ventas: Record<string, TotalesAsesor | undefined>,
  meta: MetaRanking | null | undefined,
  cfg: ConfigRanking,
): Record<string, number> {
  const ids = Array.from(new Set([...asesorIds, ...Object.keys(ventas)]));
  const pos: Record<string, number> = {};
  ordenarPorScore(ids, calcularScores(ids, ventas, meta, cfg)).forEach((id, i) => { pos[id] = i; });
  return pos;
}

// Parámetros del algoritmo: tiendas/{uid}/config/ranking (si no existe, valores por defecto).
export function useConfigRanking(storeId: string | null | undefined): ConfigRanking {
  const [cfg, setCfg] = useState<ConfigRanking>(CONFIG_RANKING_DEFAULT);
  useEffect(() => {
    if (!storeId) return;
    return onSnapshot(
      doc(db, 'tiendas', storeId, 'config', 'ranking'),
      (snap) => setCfg(normalizarConfigRanking(snap.exists() ? snap.data() : null)),
      (err) => console.error('config/ranking:', err),
    );
  }, [storeId]);
  return cfg;
}
