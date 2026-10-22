// Quiz engine: pure logic with no DOM access, so it runs in the browser and in Node tests.

export const TYPES = ['single', 'multiple', 'boolean', 'text'];
export const BOOLEAN_OPTIONS = ['Үнэн', 'Худал'];

export const DEFAULT_CONFIG = {
  rounds: 3,
  perRound: 5,
  categories: [],            // empty = all categories
  difficulty: 'progressive', // 'progressive' | 'mixed' | 1 | 2 | 3
  shuffleQuestions: true,
  shuffleOptions: true,
  timePerQuestion: 20,       // seconds, 0 = no timer
  passThreshold: 0.5,        // min round accuracy to advance, 0 = always advance
  lifelines: { fifty: 1, skip: 1, time: 1 },
  seed: null,
};

export const SCORING = {
  basePerDifficulty: 100,
  timeBonusMax: 0.5,     // up to +50% of base for answering instantly
  streakStep: 0.25,      // multiplier grows 0.25 per consecutive correct answer
  streakMax: 2,
  partialFactor: 0.5,    // partially-correct multiple choice earns half of its share
  fiftyPenalty: 0.5,
  perfectRoundBonus: 200, // × round number
  extraTime: 15,
};

// ---------- randomness ----------

export function hashSeed(value) {
  const str = String(value);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function createRng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return function mulberry32() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Unbiased Fisher–Yates; returns a new array.
export function shuffle(items, rng = Math.random) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- normalisation & validation ----------

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,!?;:"'«»()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const DIFFICULTY_WORDS = {
  1: ['1', 'easy', 'хялбар', 'амархан', 'e'],
  2: ['2', 'medium', 'дунд', 'normal', 'm'],
  3: ['3', 'hard', 'хэцүү', 'хүнд', 'h'],
};

export function parseDifficulty(value) {
  if (value === undefined || value === null || value === '') return 1;
  const key = normalizeText(value);
  for (const [level, words] of Object.entries(DIFFICULTY_WORDS)) {
    if (words.includes(key)) return Number(level);
  }
  const n = Number(value);
  if (Number.isFinite(n)) return Math.min(3, Math.max(1, Math.round(n)));
  return null;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const key = normalizeText(value);
  if (['true', 'yes', 'үнэн', 'тийм', 'зөв', '1'].includes(key)) return true;
  if (['false', 'no', 'худал', 'үгүй', 'буруу', '0'].includes(key)) return false;
  return null;
}

function toList(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

// Resolves one answer token to an option index: exact option text first,
// then a 0-based integer index, then a letter (A, B, C…).
function resolveOptionIndex(token, options) {
  if (typeof token === 'string') {
    const norm = normalizeText(token);
    const byText = options.findIndex((o) => normalizeText(o) === norm);
    if (byText !== -1) return byText;
    if (/^\d+$/.test(token.trim())) token = Number(token.trim());
    else if (/^[a-z]$/i.test(token.trim())) {
      const idx = token.trim().toUpperCase().charCodeAt(0) - 65;
      return idx < options.length ? idx : -1;
    }
  }
  if (Number.isInteger(token) && token >= 0 && token < options.length) return token;
  return -1;
}

// Accepts loose user data and returns { question } or { errors }.
export function normalizeQuestion(raw, index = 0) {
  const label = `#${index + 1}`;
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { errors: [`${label}: асуулт объект байх ёстой`] };
  }

  const text = String(raw.question ?? raw.q ?? raw.text ?? '').trim();
  if (!text) errors.push(`${label}: асуултын текст ("question") хоосон байна`);

  let options = toList(raw.options ?? raw.choices).map((o) => String(o).trim());
  const answerRaw = raw.answer ?? raw.answers ?? raw.correct;
  let type = raw.type ? String(raw.type).trim().toLowerCase() : null;

  if (type && !TYPES.includes(type)) {
    errors.push(`${label}: "${type}" төрөл танигдахгүй (${TYPES.join(', ')})`);
    type = null;
  }
  if (!type) {
    if (options.length === 0 && parseBoolean(answerRaw) !== null && typeof answerRaw !== 'number' && !Array.isArray(answerRaw)) type = 'boolean';
    else if (options.length === 0) type = 'text';
    else if (Array.isArray(answerRaw) && answerRaw.length > 1) type = 'multiple';
    else type = 'single';
  }

  let correct = [];
  let accepted = [];

  if (type === 'boolean') {
    const b = parseBoolean(Array.isArray(answerRaw) ? answerRaw[0] : answerRaw);
    options = BOOLEAN_OPTIONS.slice();
    if (b === null) errors.push(`${label}: үнэн/худал асуултын хариулт true эсвэл false байх ёстой`);
    else correct = [b ? 0 : 1];
  } else if (type === 'text') {
    accepted = toList(answerRaw).map((a) => String(a).trim()).filter(Boolean);
    options = [];
    if (accepted.length === 0) errors.push(`${label}: бичгээр хариулах асуултад зөв хариулт байх ёстой`);
  } else {
    if (options.length < 2) errors.push(`${label}: дор хаяж 2 сонголт ("options") хэрэгтэй`);
    const seen = new Set();
    for (const o of options) {
      const n = normalizeText(o);
      if (!n) errors.push(`${label}: хоосон сонголт байна`);
      else if (seen.has(n)) errors.push(`${label}: "${o}" сонголт давхардсан байна`);
      seen.add(n);
    }
    const tokens = toList(answerRaw);
    if (tokens.length === 0) errors.push(`${label}: зөв хариулт ("answer") заагаагүй байна`);
    for (const t of tokens) {
      const idx = resolveOptionIndex(t, options);
      if (idx === -1) errors.push(`${label}: "${t}" хариулт сонголтуудын аль нэгтэй таарахгүй байна`);
      else if (!correct.includes(idx)) correct.push(idx);
    }
    if (type === 'single' && correct.length > 1) {
      errors.push(`${label}: "single" төрөлд ганц зөв хариулт байна (олон бол "multiple" гэж заа)`);
    }
  }

  const difficulty = parseDifficulty(raw.difficulty ?? raw.level);
  if (difficulty === null) errors.push(`${label}: түвшин 1–3 (easy/medium/hard) байх ёстой`);

  const time = raw.time === undefined || raw.time === '' ? null : Number(raw.time);
  if (time !== null && !(Number.isFinite(time) && time > 0)) errors.push(`${label}: "time" эерэг тоо байх ёстой`);
  const points = raw.points === undefined || raw.points === '' ? null : Number(raw.points);
  if (points !== null && !(Number.isFinite(points) && points > 0)) errors.push(`${label}: "points" эерэг тоо байх ёстой`);

  if (errors.length) return { errors };

  return {
    question: {
      id: raw.id !== undefined && raw.id !== '' ? String(raw.id) : `q${index + 1}`,
      type,
      question: text,
      options,
      correct: correct.sort((a, b) => a - b),
      accepted,
      difficulty,
      category: String(raw.category ?? raw.topic ?? '').trim() || 'Ерөнхий',
      explanation: raw.explanation ? String(raw.explanation) : '',
      time,
      points,
    },
  };
}

export function validateQuestions(input) {
  const list = Array.isArray(input) ? input : input && Array.isArray(input.questions) ? input.questions : null;
  if (!list) return { questions: [], errors: ['Өгөгдөл нь асуултын массив эсвэл { "questions": [...] } байх ёстой'] };

  const questions = [];
  const errors = [];
  const ids = new Set();
  list.forEach((raw, i) => {
    const res = normalizeQuestion(raw, i);
    if (res.errors) { errors.push(...res.errors); return; }
    let id = res.question.id;
    for (let n = 2; ids.has(id); n++) id = `${res.question.id}-${n}`;
    ids.add(id);
    questions.push({ ...res.question, id });
  });
  if (list.length === 0) errors.push('Асуулт алга байна');
  return { questions, errors };
}

// Inverse of normalizeQuestion: a plain object that re-imports to the same question.
export function toPortable(q) {
  const out = { id: q.id, type: q.type, category: q.category, difficulty: q.difficulty, question: q.question };
  if (q.type === 'boolean') out.answer = q.correct[0] === 0;
  else if (q.type === 'text') out.answer = q.accepted.slice();
  else {
    out.options = q.options.slice();
    out.answer = q.correct.map((i) => q.options[i]);
    if (q.type === 'single') out.answer = out.answer[0];
  }
  if (q.explanation) out.explanation = q.explanation;
  if (q.time) out.time = q.time;
  if (q.points) out.points = q.points;
  return out;
}

// ---------- import formats ----------

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text).replace(/^﻿/, '');
  const delimiter = detectDelimiter(src);

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((f) => f.trim() !== ''));
  if (nonEmpty.length < 2) return [];
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  const listFields = new Set(['options', 'choices', 'answer', 'answers', 'correct']);

  return nonEmpty.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      const value = (r[i] ?? '').trim();
      if (!h || value === '') return;
      obj[h] = listFields.has(h) && value.includes('|') ? value.split('|').map((s) => s.trim()) : value;
    });
    if (obj.options && !Array.isArray(obj.options)) obj.options = [obj.options];
    return obj;
  });
}

function detectDelimiter(src) {
  const firstLine = src.split(/\r?\n/, 1)[0];
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

// Accepts JSON text or CSV text.
export function parseInput(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { questions: [], errors: ['Өгөгдөл хоосон байна'] };
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return validateQuestions(JSON.parse(trimmed));
    } catch (e) {
      return { questions: [], errors: [`JSON алдаа: ${e.message}`] };
    }
  }
  return validateQuestions(parseCSV(trimmed));
}

// ---------- game construction ----------

function chunkEvenly(items, parts) {
  const out = [];
  const size = Math.floor(items.length / parts);
  let extra = items.length % parts;
  let i = 0;
  for (let p = 0; p < parts; p++) {
    const len = size + (extra-- > 0 ? 1 : 0);
    out.push(items.slice(i, i + len));
    i += len;
  }
  return out;
}

export function selectQuestions(questions, config, rng) {
  let pool = questions;
  if (config.categories && config.categories.length) {
    const wanted = new Set(config.categories);
    pool = pool.filter((q) => wanted.has(q.category));
  }
  if ([1, 2, 3].includes(Number(config.difficulty))) {
    pool = pool.filter((q) => q.difficulty === Number(config.difficulty));
  }
  if (config.shuffleQuestions) pool = shuffle(pool, rng);

  const want = Math.max(1, config.rounds) * Math.max(1, config.perRound);
  let picked = pool.slice(0, want);
  // Array.prototype.sort is stable, so random order is kept inside each difficulty.
  if (config.difficulty === 'progressive') picked = picked.slice().sort((a, b) => a.difficulty - b.difficulty);
  return picked;
}

function makeInstance(q, config, rng) {
  const options = q.options.map((text, i) => ({ id: `${q.id}:${i}`, text, correct: q.correct.includes(i) }));
  const ordered = config.shuffleOptions && q.type !== 'boolean' ? shuffle(options, rng) : options;
  return {
    id: q.id,
    type: q.type,
    question: q.question,
    category: q.category,
    difficulty: q.difficulty,
    explanation: q.explanation,
    time: q.time ?? config.timePerQuestion,
    points: q.points ?? q.difficulty * SCORING.basePerDifficulty,
    options: ordered.map(({ id, text }) => ({ id, text })),
    correctIds: ordered.filter((o) => o.correct).map((o) => o.id),
    accepted: q.accepted,
  };
}

export function createGame(questions, userConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...userConfig, lifelines: { ...DEFAULT_CONFIG.lifelines, ...(userConfig.lifelines || {}) } };
  const seed = config.seed ?? Math.floor(Math.random() * 2 ** 32);
  const rng = createRng(seed);
  const picked = selectQuestions(questions, config, rng);
  if (picked.length === 0) throw new Error('Сонгосон шүүлтүүрт тохирох асуулт алга');

  const roundCount = Math.min(Math.max(1, config.rounds), picked.length);
  const rounds = chunkEvenly(picked, roundCount).map((group) => {
    // Re-shuffle within a round so progressive games are not strictly sorted.
    const ordered = config.shuffleQuestions && config.difficulty === 'progressive' ? shuffle(group, rng) : group;
    return ordered.map((q) => makeInstance(q, config, rng));
  });
  return new QuizGame(rounds, { ...config, seed }, rng);
}

// ---------- scoring ----------

export function streakMultiplier(streak) {
  return Math.min(SCORING.streakMax, 1 + Math.max(0, streak - 1) * SCORING.streakStep);
}

export function grade(accuracy) {
  if (accuracy >= 0.95) return 'S';
  if (accuracy >= 0.85) return 'A';
  if (accuracy >= 0.7) return 'B';
  if (accuracy >= 0.5) return 'C';
  return 'D';
}

// Returns fraction in [0, 1] of how correct the response is.
export function evaluate(q, response) {
  if (response === null || response === undefined) return 0;
  if (q.type === 'text') {
    const given = normalizeText(response);
    return given && q.accepted.some((a) => normalizeText(a) === given) ? 1 : 0;
  }
  const picked = new Set(toList(response));
  if (q.type === 'multiple') {
    const hits = q.correctIds.filter((id) => picked.has(id)).length;
    const wrong = [...picked].filter((id) => !q.correctIds.includes(id)).length;
    return Math.max(0, (hits - wrong) / q.correctIds.length);
  }
  return picked.size === 1 && picked.has(q.correctIds[0]) ? 1 : 0;
}

// ---------- game state machine ----------

export class QuizGame {
  constructor(rounds, config, rng = Math.random) {
    this.rounds = rounds;
    this.config = config;
    this.rng = rng;
    this.roundIndex = 0;
    this.questionIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.lifelines = { ...config.lifelines };
    this.log = [];           // one entry per answered/skipped question
    this.roundBonuses = [];
    this.status = 'question'; // 'question' | 'answered' | 'round-end' | 'finished'
    this.failed = false;
    this.hidden = [];         // option ids removed by 50/50
    this.extraTime = 0;
  }

  get totalQuestions() { return this.rounds.reduce((n, r) => n + r.length, 0); }
  get current() { return this.rounds[this.roundIndex]?.[this.questionIndex] ?? null; }
  get timeLimit() { const t = this.current?.time || 0; return t ? t + this.extraTime : 0; }
  get position() {
    const before = this.rounds.slice(0, this.roundIndex).reduce((n, r) => n + r.length, 0);
    return before + this.questionIndex + 1;
  }
  get isLastRound() { return this.roundIndex === this.rounds.length - 1; }

  // response: option id / array of ids / text / null (timeout). elapsed: seconds spent.
  answer(response, elapsed = 0) {
    if (this.status !== 'question') throw new Error('Энэ асуултад аль хэдийн хариулсан');
    const q = this.current;
    const fraction = evaluate(q, response);
    const correct = fraction === 1;
    const limit = this.timeLimit;
    const usedFifty = this.hidden.length > 0;

    let base = 0, timeBonus = 0, multiplier = 1;
    if (correct) {
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      base = q.points;
      if (limit > 0) {
        const remaining = Math.max(0, limit - elapsed) / limit;
        timeBonus = Math.round(q.points * SCORING.timeBonusMax * remaining);
      }
      multiplier = streakMultiplier(this.streak);
    } else {
      this.streak = 0;
      base = fraction > 0 ? Math.round(q.points * fraction * SCORING.partialFactor) : 0;
    }
    const penalty = usedFifty ? SCORING.fiftyPenalty : 1;
    const points = Math.round((base + timeBonus) * multiplier * penalty);
    this.score += points;

    const result = {
      questionId: q.id,
      round: this.roundIndex,
      correct,
      partial: !correct && fraction > 0,
      skipped: false,
      timedOut: response === null || response === undefined,
      response,
      fraction,
      points,
      breakdown: { base, timeBonus, multiplier, penalty },
      streak: this.streak,
      correctIds: q.correctIds,
      elapsed,
    };
    this.log.push(result);
    this.status = 'answered';
    return result;
  }

  useFifty() {
    const q = this.current;
    if (this.status !== 'question' || this.lifelines.fifty <= 0 || this.hidden.length) return null;
    if (q.type !== 'single' || q.options.length < 3) return null;
    const wrong = shuffle(q.options.filter((o) => !q.correctIds.includes(o.id)), this.rng);
    this.hidden = wrong.slice(1).map((o) => o.id); // keep one wrong option
    this.lifelines.fifty -= 1;
    return this.hidden;
  }

  useExtraTime() {
    if (this.status !== 'question' || this.lifelines.time <= 0 || !this.timeLimit) return 0;
    this.lifelines.time -= 1;
    this.extraTime += SCORING.extraTime;
    return SCORING.extraTime;
  }

  skip() {
    if (this.status !== 'question' || this.lifelines.skip <= 0) return null;
    this.lifelines.skip -= 1;
    const q = this.current;
    const result = { questionId: q.id, round: this.roundIndex, correct: false, partial: false, skipped: true, timedOut: false, response: null, fraction: 0, points: 0, breakdown: null, streak: this.streak, correctIds: q.correctIds, elapsed: 0 };
    this.log.push(result);
    this.status = 'answered';
    return result;
  }

  roundStats(index = this.roundIndex) {
    const entries = this.log.filter((e) => e.round === index);
    const counted = entries.filter((e) => !e.skipped);
    const correct = counted.filter((e) => e.correct).length;
    return {
      round: index,
      total: this.rounds[index].length,
      answered: counted.length,
      correct,
      skipped: entries.length - counted.length,
      accuracy: counted.length ? correct / counted.length : 1,
      points: entries.reduce((s, e) => s + e.points, 0) + (this.roundBonuses[index] || 0),
      bonus: this.roundBonuses[index] || 0,
    };
  }

  // Moves to the next question; at the end of a round returns the round summary.
  next() {
    if (this.status !== 'answered') throw new Error('Эхлээд хариулна уу');
    this.hidden = [];
    this.extraTime = 0;
    if (this.questionIndex < this.rounds[this.roundIndex].length - 1) {
      this.questionIndex += 1;
      this.status = 'question';
      return null;
    }
    let stats = this.roundStats();
    if (stats.answered > 0 && stats.correct === stats.answered && stats.skipped === 0) {
      this.roundBonuses[this.roundIndex] = SCORING.perfectRoundBonus * (this.roundIndex + 1);
      this.score += this.roundBonuses[this.roundIndex];
      stats = this.roundStats();
    }
    const passed = stats.accuracy >= this.config.passThreshold;
    stats.passed = passed;
    if (!passed) this.failed = true;
    this.status = !passed || this.isLastRound ? 'finished' : 'round-end';
    return stats;
  }

  startNextRound() {
    if (this.status !== 'round-end') throw new Error('Тойрог дуусаагүй байна');
    this.roundIndex += 1;
    this.questionIndex = 0;
    this.status = 'question';
  }

  results() {
    const answered = this.log.filter((e) => !e.skipped);
    const correct = answered.filter((e) => e.correct).length;
    const accuracy = answered.length ? correct / answered.length : 0;
    const playedRounds = this.rounds.slice(0, this.roundIndex + 1).map((_, i) => this.roundStats(i));
    return {
      score: this.score,
      correct,
      answered: answered.length,
      skipped: this.log.length - answered.length,
      total: this.totalQuestions,
      accuracy,
      grade: grade(accuracy),
      bestStreak: this.bestStreak,
      failed: this.failed,
      completed: !this.failed && this.status === 'finished',
      rounds: playedRounds,
      avgTime: answered.length ? answered.reduce((s, e) => s + e.elapsed, 0) / answered.length : 0,
    };
  }
}

// ---------- player progression ----------

export const LEVEL_TITLES = ['Шинэхэн', 'Суралцагч', 'Сонирхогч', 'Мэдлэгтэн', 'Мэргэн', 'Мастер', 'Аварга', 'Домог'];

export function xpForLevel(level) {
  return 250 * (level - 1) * level; // L2 = 500, L3 = 1500, L4 = 3000 …
}

export function levelInfo(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return {
    level,
    title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 2))],
    xp,
    into: xp - floor,
    needed: ceil - floor,
    progress: (xp - floor) / (ceil - floor),
  };
}

export function summarizeQuestions(questions) {
  const categories = {};
  const difficulties = { 1: 0, 2: 0, 3: 0 };
  const types = {};
  for (const q of questions) {
    categories[q.category] = (categories[q.category] || 0) + 1;
    difficulties[q.difficulty] += 1;
    types[q.type] = (types[q.type] || 0) + 1;
  }
  return { total: questions.length, categories, difficulties, types };
}
