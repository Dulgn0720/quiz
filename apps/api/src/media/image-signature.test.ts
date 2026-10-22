import { describe, expect, it } from 'vitest';
import { detectImageMime } from './image-signature';

describe('detectImageMime', () => {
  it('recognizes supported formats by their magic numbers', () => {
    expect(detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe('image/png');
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageMime(Buffer.from('GIF89a......'))).toBe('image/gif');
    expect(detectImageMime(Buffer.from('RIFF\0\0\0\0WEBP'))).toBe('image/webp');
  });

  it('rejects anything else', () => {
    expect(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeUndefined();
    expect(detectImageMime(Buffer.alloc(0))).toBeUndefined();
  });
});
