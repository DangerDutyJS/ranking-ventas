// Exporta el reporte mensual a Excel (.xlsx con estilos) o PDF, con el formato de la hoja de la empresa.
// Las librerías se importan dinámicamente: solo se descargan cuando se presiona "Exportar".
import type { FilaReporte, Reporte } from '@/lib/reporte';

type Grupo = 'id' | 'meta' | 'real' | 'final' | 'pago';
type Formato = 'texto' | 'entero' | 'dec1' | 'dec2' | 'pct0' | 'pct2' | 'dinero';

interface Columna {
  titulo: string;
  campo: keyof FilaReporte;
  ancho: number;
  grupo: Grupo;
  formato: Formato;
}

const COLUMNAS: Columna[] = [
  { titulo: 'CÓD. SAP', campo: 'sap', ancho: 9, grupo: 'id', formato: 'texto' },
  { titulo: 'COLABORADOR', campo: 'colaborador', ancho: 32, grupo: 'id', formato: 'texto' },
  { titulo: 'NOMBRE DE POSICIÓN EN TIENDAS', campo: 'posicion', ancho: 14, grupo: 'id', formato: 'texto' },
  { titulo: 'HORAS DE TRABAJO', campo: 'horas', ancho: 8, grupo: 'id', formato: 'entero' },
  { titulo: 'DÍAS', campo: 'dias', ancho: 6, grupo: 'id', formato: 'entero' },
  { titulo: 'META UPT', campo: 'metaUPT', ancho: 8, grupo: 'meta', formato: 'dec2' },
  { titulo: 'REAL UPT', campo: 'realUPT', ancho: 8, grupo: 'real', formato: 'dec1' },
  { titulo: '% CUMP. UPT', campo: 'pctUPT', ancho: 8, grupo: 'meta', formato: 'pct0' },
  { titulo: 'PUNTOS UPT', campo: 'ptsUPT', ancho: 8, grupo: 'meta', formato: 'entero' },
  { titulo: 'UNIDADES ACC / DPT META', campo: 'metaAVT', ancho: 15, grupo: 'meta', formato: 'dinero' },
  { titulo: 'CANTIDAD ACC / DPT REAL', campo: 'realAVT', ancho: 15, grupo: 'real', formato: 'dinero' },
  { titulo: '% CUMP. UND ACC / DPT', campo: 'pctAVT', ancho: 9, grupo: 'meta', formato: 'pct0' },
  { titulo: 'PUNTOS UND ACC / DPT', campo: 'ptsAVT', ancho: 9, grupo: 'meta', formato: 'entero' },
  { titulo: 'TOTALES $$', campo: 'metaVenta', ancho: 18, grupo: 'meta', formato: 'dinero' },
  { titulo: 'REAL VENTAS', campo: 'realVenta', ancho: 18, grupo: 'real', formato: 'dinero' },
  { titulo: '% CUMPL. VENTAS', campo: 'pctVenta', ancho: 9, grupo: 'meta', formato: 'pct0' },
  { titulo: 'PUNTOS VENTAS', campo: 'ptsVenta', ancho: 9, grupo: 'meta', formato: 'entero' },
  { titulo: 'CUMP. FINAL', campo: 'cumplimiento', ancho: 11, grupo: 'final', formato: 'pct2' },
  { titulo: 'PAGO COMISIONES MENSUAL', campo: 'comision', ancho: 17, grupo: 'pago', formato: 'dinero' },
];

// Colores de la hoja de la empresa.
const C = {
  navy: '0B2E6B',
  blanco: 'FFFFFF',
  id: 'D9EAD3',
  meta: 'BDD7EE',
  real: 'FCE4D6',
  verde: '3FAE49',
  amarillo: 'FFFF00',
  rojo: 'E53935',
  verdeTotal: '2E7D32',
  morado: '6A1B9A',
  borde: 'A6A6A6',
};

function colorCumplimiento(f: FilaReporte): string | null {
  if (f.cumplimiento === null) return null;
  if (f.cumplimiento >= 100) return C.verde;
  if (f.cumplimiento >= 90) return C.amarillo;
  return C.rojo;
}

const colorGrupo: Record<Grupo, string> = { id: C.id, meta: C.meta, real: C.real, final: C.blanco, pago: C.blanco };

function nombreArchivo(reporte: Reporte, ext: string) {
  return `ranking-ventas-${reporte.mes}.${ext}`;
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Formatos de texto (PDF) ───────────────────────────────────────────────────
const dinero = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function texto(valor: unknown, formato: Formato): string {
  if (valor === null || valor === undefined || valor === '') return '-';
  const n = Number(valor);
  switch (formato) {
    case 'texto': return String(valor);
    case 'entero': return Math.round(n).toLocaleString('es-CO');
    case 'dec1': return n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case 'dec2': return n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'pct0': return `${Math.round(n)}%`;
    case 'pct2': return `${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    case 'dinero': return n === 0 ? '$0,00' : dinero(n);
  }
}

// ── Excel ─────────────────────────────────────────────────────────────────────
const FORMATO_EXCEL: Record<Formato, string | undefined> = {
  texto: undefined,
  entero: '0',
  dec1: '0.0',
  dec2: '0.00',
  pct0: '0%',
  pct2: '0.00%',
  dinero: '"$"#,##0.00',
};

export async function exportarExcel(reporte: Reporte) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ranking Ventas';
  const ws = wb.addWorksheet(reporte.mes, { views: [{ state: 'frozen', ySplit: 3, xSplit: 2 }] });

  const borde = { style: 'thin' as const, color: { argb: `FF${C.borde}` } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };
  const relleno = (hex: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: `FF${hex}` } });

  ws.columns = COLUMNAS.map((c) => ({ width: c.ancho }));

  // Título
  ws.mergeCells(1, 1, 1, COLUMNAS.length);
  const t = ws.getCell(1, 1);
  t.value = reporte.titulo.toUpperCase();
  t.font = { bold: true, size: 14, color: { argb: `FF${C.navy}` } };
  t.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(1).height = 24;

  // Encabezados
  const filaEnc = ws.getRow(3);
  COLUMNAS.forEach((c, i) => {
    const cell = filaEnc.getCell(i + 1);
    cell.value = c.titulo;
    cell.font = { bold: true, size: 9, color: { argb: `FF${C.blanco}` } };
    cell.fill = relleno(c.grupo === 'pago' ? C.morado : C.navy);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = bordes;
  });
  filaEnc.height = 42;

  // Filas
  reporte.filas.forEach((f, idx) => {
    const row = ws.getRow(4 + idx);
    COLUMNAS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const v = f[c.campo];
      const esPct = c.formato === 'pct0' || c.formato === 'pct2';
      cell.value = v === null || v === '' ? null : esPct ? Number(v) / 100 : (v as string | number);
      if (FORMATO_EXCEL[c.formato]) cell.numFmt = FORMATO_EXCEL[c.formato]!;
      const fondo = c.grupo === 'final' ? colorCumplimiento(f) : colorGrupo[c.grupo];
      if (fondo) cell.fill = relleno(fondo);
      cell.font = {
        size: 9,
        bold: c.grupo === 'final' || c.campo === 'realVenta' || c.campo === 'realUPT' || c.campo === 'realAVT',
        color: { argb: c.grupo === 'final' && fondo && fondo !== C.amarillo ? `FF${C.blanco}` : 'FF000000' },
      };
      cell.alignment = { horizontal: c.formato === 'texto' && c.campo !== 'sap' ? (c.campo === 'colaborador' ? 'left' : 'center') : 'center', vertical: 'middle' };
      cell.border = bordes;
    });
    row.height = 18;
  });

  // Totales
  const r = ws.getRow(4 + reporte.filas.length);
  const tot = reporte.totales;
  const valorTotal: Partial<Record<keyof FilaReporte, number | null>> = {
    horas: tot.horas,
    metaAVT: tot.metaAVTPromedio,
    realAVT: tot.realAVTPromedio,
    metaVenta: tot.metaVenta,
    realVenta: tot.realVenta,
    comision: tot.comision,
  };
  COLUMNAS.forEach((c, i) => {
    const cell = r.getCell(i + 1);
    if (i === 1) cell.value = 'TOTAL';
    const v = valorTotal[c.campo];
    if (v !== undefined && v !== null) {
      cell.value = v;
      if (FORMATO_EXCEL[c.formato]) cell.numFmt = FORMATO_EXCEL[c.formato]!;
    }
    const fondo = c.campo === 'metaVenta' || c.campo === 'realVenta' ? C.verdeTotal : c.grupo === 'pago' ? C.morado : C.navy;
    cell.fill = relleno(fondo);
    cell.font = { bold: true, size: 9, color: { argb: `FF${C.blanco}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = bordes;
  });
  r.height = 20;

  ws.getCell(5 + reporte.filas.length, 1).value =
    `Cumplimiento final = Venta 80% + UPT 10% + Ticket promedio (ACC/DPT) 10%. Promedios de ACC/DPT en la fila TOTAL.${reporte.ivaVentas > 0 ? ` Valores en pesos SIN IVA (registros con IVA ÷ ${(1 + reporte.ivaVentas / 100).toLocaleString('es-CO')}).` : reporte.sinIvaAlRegistrar ? ' Valores en pesos SIN IVA (descontado al registrar cada venta).' : ''}`;
  ws.getCell(5 + reporte.filas.length, 1).font = { italic: true, size: 8, color: { argb: 'FF666666' } };

  const buffer = await wb.xlsx.writeBuffer();
  descargar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombreArchivo(reporte, 'xlsx'));
}

// ── PDF ───────────────────────────────────────────────────────────────────────
const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];

export async function exportarPDF(reporte: Reporte) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'legal' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(...rgb(C.navy));
  pdf.text(reporte.titulo.toUpperCase(), 24, 30);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(102, 102, 102);
  pdf.text(`Generado el ${new Date().toLocaleString('es-CO')} · Cumplimiento final = Venta 80% + UPT 10% + Ticket promedio (ACC/DPT) 10%${reporte.ivaVentas > 0 || reporte.sinIvaAlRegistrar ? ' · Valores en pesos SIN IVA' : ''}`, 24, 44);

  const tot = reporte.totales;
  const pie: Partial<Record<keyof FilaReporte, string>> = {
    colaborador: 'TOTAL',
    horas: texto(tot.horas, 'entero'),
    metaAVT: tot.metaAVTPromedio !== null ? texto(tot.metaAVTPromedio, 'dinero') : '-',
    realAVT: tot.realAVTPromedio !== null ? texto(tot.realAVTPromedio, 'dinero') : '-',
    metaVenta: texto(tot.metaVenta, 'dinero'),
    realVenta: texto(tot.realVenta, 'dinero'),
    comision: texto(tot.comision, 'dinero'),
  };

  autoTable(pdf, {
    startY: 54,
    margin: { left: 24, right: 24 },
    head: [COLUMNAS.map((c) => c.titulo)],
    body: reporte.filas.map((f) => COLUMNAS.map((c) => texto(f[c.campo], c.formato))),
    foot: [COLUMNAS.map((c) => pie[c.campo] ?? '')],
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: rgb(C.borde), lineWidth: 0.4, textColor: [0, 0, 0] },
    headStyles: { fillColor: rgb(C.navy), textColor: 255, fontStyle: 'bold', fontSize: 6 },
    footStyles: { fillColor: rgb(C.navy), textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'left', cellWidth: 120 } },
    didParseCell: (data) => {
      const col = COLUMNAS[data.column.index];
      if (!col) return;
      if (data.section === 'head' && col.grupo === 'pago') data.cell.styles.fillColor = rgb(C.morado);
      if (data.section === 'foot') {
        if (col.campo === 'metaVenta' || col.campo === 'realVenta') data.cell.styles.fillColor = rgb(C.verdeTotal);
        if (col.grupo === 'pago') data.cell.styles.fillColor = rgb(C.morado);
      }
      if (data.section === 'body') {
        const f = reporte.filas[data.row.index];
        const fondo = col.grupo === 'final' ? colorCumplimiento(f) : colorGrupo[col.grupo];
        if (fondo) data.cell.styles.fillColor = rgb(fondo);
        if (col.grupo === 'final' || col.grupo === 'real') data.cell.styles.fontStyle = 'bold';
        if (col.grupo === 'final' && fondo && fondo !== C.amarillo) data.cell.styles.textColor = 255;
      }
    },
  });

  pdf.save(nombreArchivo(reporte, 'pdf'));
}
