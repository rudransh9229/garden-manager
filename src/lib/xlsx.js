// A small Excel (.xlsx) writer. No library: an .xlsx file is a zip of a few XML files, and the zip writer already exists.
// It supports what a statement needs: several sheets, text, numbers, dates, live formulas (with their last result stored,
// so every viewer shows numbers even before it recalculates), a few cell styles, column widths and a frozen header row.
import { makeZip } from './zip.js';

const enc = new TextEncoder();

/**
 * Cell styles by name. Order matters: the position is the style number in styles.xml.
 * Fonts: 0 normal, 1 bold, 2 bold white, 3 title, 4 italic grey. Fills: 2 dark green, 3 light green.
 * Number formats: 164 money, 165 date, 166 percent. Borders: 1 line above.
 */
const STYLES = [
  ['default', { font: 0 }],
  ['title', { font: 3 }],
  ['header', { font: 2, fill: 2, wrap: true }],
  ['headerR', { font: 2, fill: 2, wrap: true, align: 'right' }],
  ['bold', { font: 1 }],
  ['money', { numFmt: 164 }],
  ['moneyTotal', { font: 1, numFmt: 164, border: 1 }],
  ['date', { numFmt: 165, align: 'left' }],
  ['note', { font: 4 }],
  ['pct', { numFmt: 166 }],
  ['section', { font: 1, fill: 3 }],
  ['sectionMoney', { font: 1, fill: 3, numFmt: 164 }],
  ['wrap', { wrap: true }],
  ['labelTotal', { font: 1, border: 1 }],
  ['moneyBold', { font: 1, numFmt: 164 }],
  ['headline', { font: 1, fill: 3, numFmt: 164, border: 1 }],
  ['headlineLabel', { font: 1, fill: 3, border: 1 }],
];
const STYLE_INDEX = Object.fromEntries(STYLES.map(([name], i) => [name, i]));

const stylesXml = () => {
  const xfs = STYLES.map(([, s]) => {
    const align = s.wrap || s.align ? `<alignment${s.align ? ` horizontal="${s.align}"` : ''}${s.wrap ? ' wrapText="1" vertical="top"' : ''}/>` : '';
    return `<xf numFmtId="${s.numFmt || 0}" fontId="${s.font || 0}" fillId="${s.fill || 0}" borderId="${s.border || 0}" xfId="0"` +
      `${s.numFmt ? ' applyNumberFormat="1"' : ''}${s.font ? ' applyFont="1"' : ''}${s.fill ? ' applyFill="1"' : ''}${s.border ? ' applyBorder="1"' : ''}${align ? ' applyAlignment="1">' + align + '</xf>' : '/>'}`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;₹&quot;#,##0.00;[Red]-&quot;₹&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="dd\\ mmm\\ yyyy"/><numFmt numFmtId="166" formatCode="0.0%"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="16"/><color rgb="FF16392B"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF5C665F"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1B5B38"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE3EFE7"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top style="thin"><color auto="1"/></top><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${STYLES.length}">${xfs}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // XML 1.0 cannot hold most control characters
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

export function colLetter(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
export const cellRef = (row, col) => `${colLetter(col)}${row + 1}`;

/** Excel stores a date as the number of days since 30 Dec 1899. */
export function excelDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

/**
 * A cell is: null, a string, a number, or { v, s, f, date }
 *   v: value (string or number), s: style name, f: formula without "=" (v is then its last result), date: ISO string.
 */
function cellXml(cell, r, c) {
  if (cell === null || cell === undefined || cell === '') return '';
  const o = typeof cell === 'object' ? cell : { v: cell };
  const ref = cellRef(r, c);
  const style = o.s ? STYLE_INDEX[o.s] : o.date ? STYLE_INDEX.date : 0;
  const sAttr = style ? ` s="${style}"` : '';
  if (o.date) return `<c r="${ref}"${sAttr}><v>${excelDate(o.date)}</v></c>`;
  if (o.f) {
    const isText = typeof o.v === 'string';
    return `<c r="${ref}"${sAttr}${isText ? ' t="str"' : ''}><f>${esc(o.f)}</f><v>${isText ? esc(o.v) : Number.isFinite(o.v) ? o.v : 0}</v></c>`;
  }
  if (typeof o.v === 'number') return Number.isFinite(o.v) ? `<c r="${ref}"${sAttr}><v>${o.v}</v></c>` : '';
  return `<c r="${ref}" t="inlineStr"${sAttr}><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`;
}

function sheetXml({ rows, cols = [], freezeRow = 0, landscape = true }) {
  const colsXml = cols.length ? `<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const pane = freezeRow ? `<pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/>` : '';
  const data = rows.map((row, r) => {
    const cells = row.map((cell, c) => cellXml(cell, r, c)).join('');
    return cells ? `<row r="${r + 1}">${cells}</row>` : '';
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${colsXml}<sheetData>${data}</sheetData><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

/** Sheet names: at most 31 characters and none of  [ ] : * ? / \ */
export const safeSheetName = (n) => String(n).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';

/** sheets: [{ name, rows, cols, freezeRow, landscape }]. Returns a Blob of the .xlsx file. */
export async function makeXlsx(sheets, { title = '' } = {}) {
  const names = sheets.map((s) => safeSheetName(s.name));
  const files = [];
  const add = (name, text) => files.push({ name, data: enc.encode(text) });
  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>Garden Manager</dc:creator></cp:coreProperties>`);
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  add('xl/styles.xml', stylesXml());
  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  const zip = await makeZip(files);
  return new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
