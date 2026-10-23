import { describe, expect, it } from 'vitest';
import { CHAT, chatMessageSchema, cleanChatText } from './game';

describe('chat', () => {
  it('trims, collapses spaces and hides links', () => {
    expect(cleanChatText('  Гоё   асуулт!  ')).toBe('Гоё асуулт!');
    expect(cleanChatText('see https://evil.example/login now')).toBe('see 🔗 now');
    expect(cleanChatText('www.spam.mn')).toBe('🔗');
  });

  it('accepts short messages and rejects empty or huge ones', () => {
    expect(chatMessageSchema.parse({ text: ' Хаха 😂 ' })).toEqual({ text: 'Хаха 😂' });
    expect(chatMessageSchema.safeParse({ text: '   ' }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ text: 'a'.repeat(CHAT.maxLength * 3) }).success).toBe(false);
    expect(chatMessageSchema.parse({ text: 'a'.repeat(CHAT.maxLength + 20) }).text).toHaveLength(CHAT.maxLength);
  });
});
