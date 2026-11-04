import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// Heavy libs: import this module dynamically from the export route only.

const XLSX_WIDTHS = [12, 10, 11, 20, 28, 22, 60];

// rows[0] is the header (see toExportRows).
export async function buildLogXlsx(
  rows: string[][],
  sheetName: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  XLSX_WIDTHS.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });
  sheet.getColumn(XLSX_WIDTHS.length).alignment = { wrapText: true, vertical: 'top' };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

const PDF_MARGIN = 36;
const PDF_PAD = 4;
// Fractions of the usable width, one per column.
const PDF_WIDTHS = [0.09, 0.07, 0.07, 0.12, 0.14, 0.13, 0.38];

// Standard Helvetica is WinAnsi-only: replace anything outside it with '?' instead of garbling.
export const pdfText = (s: string) =>
  s.normalize('NFC').replace(/[^\t\n\r\x20-\x7e\xa0-\xff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu, '?');

// A4 landscape table with a repeated header; only standard fonts (no asset files needed).
export async function buildLogPdf(rows: string[][], title: string): Promise<Uint8Array<ArrayBuffer>> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: PDF_MARGIN });
  const chunks: Buffer[] = [];
  const done = new Promise<void>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  const usable = doc.page.width - PDF_MARGIN * 2;
  const widths = PDF_WIDTHS.map((w) => w * usable);
  const bottom = () => doc.page.height - PDF_MARGIN;

  doc.font('Helvetica-Bold').fontSize(14).text(pdfText(title), PDF_MARGIN, PDF_MARGIN);
  doc.moveDown(0.5);

  const [header, ...body] = rows.map((row) => row.map(pdfText));
  let y = doc.y;
  let maxHeight = Infinity;

  const rowHeight = (cells: string[], bold: boolean) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    const heights = cells.map((c, i) => doc.heightOfString(c, { width: widths[i] - PDF_PAD * 2 }));
    return Math.min(Math.max(...heights) + PDF_PAD * 2, maxHeight);
  };

  const drawRow = (cells: string[], bold: boolean) => {
    const height = rowHeight(cells, bold);
    let x = PDF_MARGIN;
    cells.forEach((cell, i) => {
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
      if (header) drawRow(header, true);
    }
  };

  // A row may be at most one page minus the repeated header; full text stays in XLSX.
  maxHeight = bottom() - y - (header ? rowHeight(header, true) : 0);
  if (header) drawRow(header, true);
  body.forEach((row) => {
    ensureSpace(rowHeight(row, false));
    drawRow(row, false);
  });

  doc.end();
  await done;
  return new Uint8Array(Buffer.concat(chunks));
}
