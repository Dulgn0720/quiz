import { describe, expect, it } from 'vitest';
import { dailyWord, emptyStats, keyboardStates, MONGOLIAN_LETTERS, recordDaily, scoreGuess, shareText, WORD_LENGTH } from './word-game';
import { WORDS } from './words';

describe('scoreGuess', () => {
  it('marks right letters in place, elsewhere and missing', () => {
    expect(scoreGuess('гэрэл', 'гэрэл')).toEqual(['hit', 'hit', 'hit', 'hit', 'hit']);
    expect(scoreGuess('лэгрэ', 'гэрэл')).toEqual(['near', 'hit', 'near', 'near', 'near']);
    expect(scoreGuess('ббббб', 'гэрэл')).toEqual(['miss', 'miss', 'miss', 'miss', 'miss']);
  });

  it('counts a repeated letter only as often as the answer has it', () => {
    // One «а» in the answer: the in-place one wins, the other is grey.
    expect(scoreGuess('аалын', 'халун')).toEqual(['miss', 'hit', 'hit', 'miss', 'hit']);
    expect(scoreGuess('ааааа', 'халун')).toEqual(['miss', 'hit', 'miss', 'miss', 'miss']);
  });
});

describe('keyboardStates', () => {
  it('keeps the best state per letter', () => {
    const states = keyboardStates(['лэгрэ', 'гэрэл'], 'гэрэл');
    expect(states.get('г')).toBe('hit');
    expect(states.get('л')).toBe('hit');
  });
});

describe('words', () => {
  it('are unique five-letter Mongolian words with a hint', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(WORDS.map((w) => w.word)).size).toBe(WORDS.length);
    for (const { word, hint } of WORDS) {
      expect([...word]).toHaveLength(WORD_LENGTH);
      expect([...word].every((c) => MONGOLIAN_LETTERS.includes(c))).toBe(true);
      expect(hint.length).toBeGreaterThan(0);
      expect(hint.toLowerCase()).not.toContain(word);
    }
  });

  it('gives everyone the same word on a day and a new one the next day', () => {
    expect(dailyWord('2026-10-22')).toEqual(dailyWord('2026-10-22'));
    expect(dailyWord('2026-10-22').word).not.toBe(dailyWord('2026-10-23').word);
  });
});

describe('stats', () => {
  it('records a day once and keeps the streak only from yesterday', () => {
    let stats = recordDaily(emptyStats(), '2026-10-21', '2026-10-20', 3, true);
    stats = recordDaily(stats, '2026-10-21', '2026-10-20', 3, true);
    expect(stats).toMatchObject({ played: 1, wins: 1, streak: 1 });
    stats = recordDaily(stats, '2026-10-22', '2026-10-21', 5, true);
    expect(stats).toMatchObject({ played: 2, wins: 2, streak: 2, best: 2 });
    expect(stats.distribution).toEqual([0, 0, 1, 0, 1, 0]);
    stats = recordDaily(stats, '2026-10-24', '2026-10-23', 2, true);
    expect(stats).toMatchObject({ streak: 1, best: 2 });
    stats = recordDaily(stats, '2026-10-25', '2026-10-24', 6, false);
    expect(stats).toMatchObject({ played: 4, wins: 3, streak: 0 });
  });

  it('shares an emoji grid without letters', () => {
    const text = shareText('2026-10-22', ['лэгрэ', 'гэрэл'], 'гэрэл', true);
    expect(text).toBe('Үг таах 2026-10-22 2/6\n\n🟨🟩🟨🟨🟨\n🟩🟩🟩🟩🟩');
  });
});
