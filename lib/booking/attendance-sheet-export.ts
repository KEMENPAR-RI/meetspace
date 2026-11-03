import { readFileSync } from 'node:fs';
import path from 'node:path';

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import { ATTENDANCE_SIGNATURE_COL, type AttendanceSheet } from '@/lib/booking/attendance-export';
import { pdfText } from '@/lib/booking/log-export';

// Heavy libs: import this module dynamically from the export route only.

const XLSX_WIDTHS = [5, 28, 9, 26, 16, 12, 24];
const XLSX_WRAP_COLS = [2, 4, 7];
const XLSX_INFO_START = 3;
// Approx. characters per line in the merged C:G info value.
const XLSX_INFO_CHARS = 80;
const XLSX_LINE_HEIGHT = 15;

const THIN = { style: 'thin' } as const;
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

// Cell values are plain strings/numbers only, so nothing is ever written as a formula.
export async function buildAttendanceXlsx(sheet: AttendanceSheet): Promise<Uint8Array<ArrayBuffer>> {
  // Title, blank, info rows, blank, then the table header.
  const headerRow = XLSX_INFO_START + sheet.info.length + 1;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Daftar Hadir', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${headerRow}:${headerRow}`,
    },
    views: [{ state: 'frozen', ySplit: headerRow }],
  });
  XLSX_WIDTHS.forEach((width, i) => {
    ws.getColumn(i + 1).width = width;
  });

  ws.mergeCells('A1:G1');
  const title = ws.getCell('A1');
  title.value = sheet.title;
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: 'center' };

  sheet.info.forEach(([label, value], i) => {
    const r = XLSX_INFO_START + i;
    ws.mergeCells(`A${r}:B${r}`);
    ws.mergeCells(`C${r}:G${r}`);
    const labelCell = ws.getCell(`A${r}`);
    labelCell.value = label;
    labelCell.font = { bold: true };
    labelCell.alignment = { vertical: 'top' };
    const valueCell = ws.getCell(`C${r}`);
    valueCell.value = value;
    valueCell.alignment = { wrapText: true, vertical: 'top' };
    // Excel does not auto-fit merged cells: estimate the wrapped line count.
    const lines = value
      .split('\n')
      .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / XLSX_INFO_CHARS)), 0);
    if (lines > 1) ws.getRow(r).height = lines * XLSX_LINE_HEIGHT;
  });

  const header = ws.getRow(headerRow);
  header.values = sheet.header;
  header.eachCell((cell) => {
    cell.font = { bold: true };
    cell.border = BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
  });

  const first = headerRow + 1;
  if (sheet.rows.length === 0) {
    ws.mergeCells(`A${first}:G${first}`);
    const empty = ws.getCell(`A${first}`);
    empty.value = sheet.emptyText;
    empty.alignment = { horizontal: 'center' };
    empty.border = BORDER;
  } else {
    sheet.rows.forEach(([no, ...rest], i) => {
      const row = ws.getRow(first + i);
      row.values = [Number(no), ...rest];
      for (let c = 1; c <= XLSX_WIDTHS.length; c++) {
        const cell = row.getCell(c);
        cell.border = BORDER;
        cell.alignment = {
          vertical: 'top',
          wrapText: XLSX_WRAP_COLS.includes(c),
          horizontal: c === 1 ? 'center' : undefined,
        };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

const PDF_MARGIN = 40;
const PDF_PAD = 4;
const PDF_FONT_SIZE = 9;
const PDF_INFO_SIZE = 10;
const PDF_INFO_LABEL = 90;
const PDF_INFO_COLON = 10;
// Fractions of the usable width, one per column.
const PDF_WIDTHS = [0.05, 0.22, 0.1, 0.21, 0.13, 0.11, 0.18];
const SIGNATURE_FONT = 'Signature';
const SIGNATURE_SIZE = 11;
// Signature cells longer than this are clipped with an ellipsis.
const SIGNATURE_MAX_LINES = 2;
const SIGNATURE_FALLBACK = 'Helvetica-Oblique';
// signature.otf only has glyphs for basic Latin letters and space.
const SIGNATURE_GLYPHS = /^[A-Za-z ]+$/;

// Cached across requests; null = unavailable (fallback font).
let signatureFontData: Buffer | null | undefined;

function loadSignatureFont(): Buffer | null {
  if (signatureFontData === undefined) {
    try {
      signatureFontData = readFileSync(path.join(process.cwd(), 'app/fonts/signature.otf'));
    } catch {
      signatureFontData = null;
    }
  }
  return signatureFontData;
}

// A4 portrait: title, info block, then a table with a repeated header on each page.
export async function buildAttendancePdf(sheet: AttendanceSheet): Promise<Uint8Array<ArrayBuffer>> {
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: PDF_MARGIN });
  const chunks: Buffer[] = [];
  const done = new Promise<void>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  // Never fail the export because of the font: fall back to Helvetica-Oblique.
  let hasSignature = false;
  const fontData = loadSignatureFont();
  if (fontData) {
    try {
      doc.registerFont(SIGNATURE_FONT, fontData);
      doc.font(SIGNATURE_FONT);
      hasSignature = true;
    } catch {
      hasSignature = false;
    }
  }

  const usable = doc.page.width - PDF_MARGIN * 2;
  const widths = PDF_WIDTHS.map((w) => w * usable);
  const bottom = () => doc.page.height - PDF_MARGIN;

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(pdfText(sheet.title), PDF_MARGIN, PDF_MARGIN, { width: usable, align: 'center' });
  doc.moveDown(1);

  let y = doc.y;
  const valueX = PDF_MARGIN + PDF_INFO_LABEL + PDF_INFO_COLON;
  const valueOpts = { width: usable - PDF_INFO_LABEL - PDF_INFO_COLON };
  for (const [label, raw] of sheet.info) {
    const value = pdfText(raw);
    doc.font('Helvetica-Bold').fontSize(PDF_INFO_SIZE).text(pdfText(label), PDF_MARGIN, y);
    doc.text(':', PDF_MARGIN + PDF_INFO_LABEL, y);
    doc.font('Helvetica').text(value, valueX, y, valueOpts);
    y += doc.heightOfString(value, valueOpts) + 4;
  }
  y += 12;

  // [font, size] for a cell; signature column uses the script font when its glyphs cover the text.
  const cellFont = (cell: string, col: number, bold: boolean): [string, number] => {
    if (bold) return ['Helvetica-Bold', PDF_FONT_SIZE];
    if (col !== ATTENDANCE_SIGNATURE_COL) return ['Helvetica', PDF_FONT_SIZE];
    return hasSignature && SIGNATURE_GLYPHS.test(cell)
      ? [SIGNATURE_FONT, SIGNATURE_SIZE]
      : [SIGNATURE_FALLBACK, PDF_FONT_SIZE];
  };
  const useFont = (cell: string, col: number, bold: boolean) => {
    const [font, size] = cellFont(cell, col, bold);
    doc.font(font).fontSize(size);
  };

  const header = sheet.header.map(pdfText);
  let maxHeight = Infinity;

  const rowHeight = (cells: string[], bold: boolean) => {
    const heights = cells.map((c, i) => {
      useFont(c, i, bold);
      const height = doc.heightOfString(c, { width: widths[i] - PDF_PAD * 2 });
      return i === ATTENDANCE_SIGNATURE_COL && !bold
        ? Math.min(height, doc.currentLineHeight(true) * SIGNATURE_MAX_LINES)
        : height;
    });
    return Math.min(Math.max(...heights) + PDF_PAD * 2, maxHeight);
  };

  const drawRow = (cells: string[], bold: boolean) => {
    const height = rowHeight(cells, bold);
    let x = PDF_MARGIN;
    cells.forEach((cell, i) => {
      useFont(cell, i, bold);
      const opts = { width: widths[i] - PDF_PAD * 2 };
      const inner = height - PDF_PAD * 2;
      // Clip overflowing cells with an ellipsis instead of letting pdfkit paginate them.
      const clip = doc.heightOfString(cell, opts) > inner ? { height: inner, ellipsis: '…' } : {};
      doc.rect(x, y, widths[i], height).stroke('#999999');
      doc.fillColor('#000000').text(cell, x + PDF_PAD, y + PDF_PAD, { ...opts, ...clip });
      x += widths[i];
    });
    y += height;
  };

  const ensureSpace = (height: number) => {
    if (y + height > bottom()) {
      doc.addPage();
      y = PDF_MARGIN;
      drawRow(header, true);
    }
  };

  // A row may be at most one page minus the repeated header.
  maxHeight = bottom() - PDF_MARGIN - rowHeight(header, true);
  // Keep the header with at least one row on the first page.
  if (y + rowHeight(header, true) * 2 > bottom()) {
    doc.addPage();
    y = PDF_MARGIN;
  }
  drawRow(header, true);

  if (sheet.rows.length === 0) {
    const text = pdfText(sheet.emptyText);
    doc.font('Helvetica').fontSize(PDF_FONT_SIZE);
    const height = doc.heightOfString(text, { width: usable - PDF_PAD * 2 }) + PDF_PAD * 2;
    doc.rect(PDF_MARGIN, y, usable, height).stroke('#999999');
    doc
      .fillColor('#000000')
      .text(text, PDF_MARGIN + PDF_PAD, y + PDF_PAD, { width: usable - PDF_PAD * 2, align: 'center' });
  } else {
    for (const raw of sheet.rows) {
      const row = raw.map(pdfText);
      ensureSpace(rowHeight(row, false));
      drawRow(row, false);
    }
  }

  doc.end();
  await done;
  return new Uint8Array(Buffer.concat(chunks));
}
