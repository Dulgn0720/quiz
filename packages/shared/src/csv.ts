/**
 * Minimal RFC 4180 CSV reader/writer. Handles quoted fields, escaped quotes,
 * embedded newlines, CRLF/LF line endings and a leading UTF-8 BOM.
 */

const BOM = '﻿';

/**
 * Picks `,` or `;` (common in spreadsheet exports for locales that use a
 * decimal comma) by counting unquoted occurrences in the first line.
 */
export function detectDelimiter(text: string): ',' | ';' {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && ch === ',') commas++;
    else if (!inQuotes && ch === ';') semicolons++;
  }
  return semicolons > commas ? ';' : ',';
}

export function parseCsv(input: string, delimiter: string = detectDelimiter(input)): string[][] {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field.length === 0) {
      inQuotes = true;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === '\r') {
      endRow();
      if (text[i + 1] === '\n') i++;
    } else if (ch === '\n') {
      endRow();
    } else {
      field += ch;
    }
    i++;
  }
  if (field.length > 0 || row.length > 0) endRow();

  // Drop blank lines (a row with a single empty field).
  return rows.filter((r) => !(r.length === 1 && r[0]!.trim() === ''));
}

function escapeField(value: string, delimiter: string): string {
  if (
    value.includes('"') ||
    value.includes(delimiter) ||
    value.includes('\n') ||
    value.includes('\r') ||
    value !== value.trim()
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function stringifyCsv(
  rows: readonly (readonly string[])[],
  { delimiter = ',', bom = false }: { delimiter?: string; bom?: boolean } = {},
): string {
  const body = rows.map((r) => r.map((f) => escapeField(f, delimiter)).join(delimiter)).join('\r\n');
  return (bom ? BOM : '') + body + '\r\n';
}
