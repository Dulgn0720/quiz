import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, stringifyCsv } from './csv';

describe('parseCsv', () => {
  it('parses quoted fields, escaped quotes and embedded newlines', () => {
    const text = 'a,b,c\r\n"x, y","say ""hi""","multi\nline"\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'multi\nline'],
    ]);
  });

  it('strips a BOM and skips blank lines', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps empty trailing fields', () => {
    expect(parseCsv('a,b,\n')).toEqual([['a', 'b', '']]);
  });

  it('detects semicolon delimiters', () => {
    expect(detectDelimiter('a;b;"c,d"\n1;2;3')).toBe(';');
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('stringifyCsv', () => {
  it('round-trips awkward values', () => {
    const rows = [['plain', 'with,comma', 'with "quote"', 'two\nlines', ' padded ', 'Монгол']];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });

  it('prefixes a BOM when asked', () => {
    expect(stringifyCsv([['a']], { bom: true })).toBe('﻿a\r\n');
  });
});
