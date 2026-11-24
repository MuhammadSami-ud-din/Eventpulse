// Spreadsheet apps run a cell that starts with one of these as a formula, so a
// student named "=HYPERLINK(...)" could plant a malicious link in the
// organizer's export. Such cells get a leading apostrophe, which makes Excel
// and Google Sheets show the text as-is.
const FORMULA_START = /^[=+\-@\t\r]/;
// Lets Excel detect UTF-8, so names like "مریم" are not garbled.
const UTF8_BOM = '﻿';

function formatCell(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  // RFC 4180: quote cells containing separators, quotes or line breaks, and double inner quotes.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// columns: [{ header: 'Name', value: (row) => row.name }, ...]
export function toCsv(rows, columns) {
  const lines = [
    columns.map((column) => formatCell(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => formatCell(column.value(row))).join(',')),
  ];
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}
