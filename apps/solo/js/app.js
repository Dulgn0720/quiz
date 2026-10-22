import {
  parseInput, createGame, levelInfo, summarizeQuestions, toPortable, DEFAULT_CONFIG,
} from './engine.js';
import { SAMPLE_SET } from './sample-data.js';

// ---------- persistence ----------

const STORE_KEY = 'quizpro:v1';
const SAMPLE_ID = 'sample';
const DIFF_LABEL = { 1: 'Хялбар', 2: 'Дунд', 3: 'Хэцүү' };
const TYPE_LABEL = { single: 'Нэг сонголт', multiple: 'Олон сонголт', boolean: 'Үнэн / Худал', text: 'Бичгээр' };

const defaultState = () => ({
  profile: { name: '', xp: 0, games: 0, best: 0, correct: 0, answered: 0 },
  sets: [],
  activeSetId: SAMPLE_ID,
  settings: { difficulty: 'progressive', rounds: 3, perRound: 5, timePerQuestion: 20, passThreshold: 0.5, seed: '', shuffleQuestions: true, shuffleOptions: true, lifelines: true, categories: [] },
  board: [],
  theme: null,
});

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && typeof saved === 'object') {
      const base = defaultState();
      return { ...base, ...saved, profile: { ...base.profile, ...saved.profile }, settings: { ...base.settings, ...saved.settings } };
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return defaultState();
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode / quota */ }
}

const state = loadState();
const sampleSet = { id: SAMPLE_ID, name: SAMPLE_SET.name, text: JSON.stringify(SAMPLE_SET.questions), builtin: true };
const allSets = () => [sampleSet, ...state.sets];
const activeSet = () => allSets().find((s) => s.id === state.activeSetId) || sampleSet;

const parsedCache = new Map();
function questionsOf(set) {
  if (!parsedCache.has(set.text)) parsedCache.set(set.text, parseInput(set.text).questions);
  return parsedCache.get(set.text);
}

// ---------- DOM helpers ----------

const $ = (id) => document.getElementById(id);
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}
const pct = (x) => `${Math.round(x * 100)}%`;

let toastTimer;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

let currentScreen = 'home';
function show(name) {
  const inGame = ['quiz', 'round'];
  if (inGame.includes(currentScreen) && !inGame.includes(name) && name !== 'results' && game && game.status !== 'finished') {
    if (!confirm('Тоглолтыг орхих уу? Явц хадгалагдахгүй.')) return;
    abandonGame();
  }
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
  $(`screen-${name}`).classList.remove('hidden');
  currentScreen = name;
  if (name === 'home') renderHome();
  if (name === 'data') renderData();
  if (name === 'board') renderBoard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applyTheme() {
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  else delete document.documentElement.dataset.theme;
}

// ---------- home ----------

function renderProfile() {
  const p = state.profile;
  const info = levelInfo(p.xp);
  $('playerName').value = p.name;
  $('levelBadge').textContent = info.level;
  $('levelTitle').textContent = `Түвшин ${info.level} · ${info.title}`;
  $('xpFill').style.width = pct(info.progress);
  $('xpText').textContent = `${info.into.toLocaleString()} / ${info.needed.toLocaleString()} XP · нийт ${p.xp.toLocaleString()}`;
  $('statGames').textContent = p.games;
  $('statBest').textContent = p.best.toLocaleString();
  $('statAcc').textContent = p.answered ? pct(p.correct / p.answered) : '—';
}

function renderHome() {
  renderProfile();
  const select = $('setSelect');
  select.replaceChildren(...allSets().map((s) => el('option', { value: s.id, text: `${s.name} (${questionsOf(s).length})` })));
  select.value = activeSet().id;

  const questions = questionsOf(activeSet());
  const sum = summarizeQuestions(questions);
  $('setSummary').replaceChildren(
    el('span', { class: 'chip ghost', text: `${sum.total} асуулт` }),
    ...[1, 2, 3].filter((d) => sum.difficulties[d]).map((d) => el('span', { class: 'chip diff', 'data-level': d, text: `${DIFF_LABEL[d]}: ${sum.difficulties[d]}` })),
  );

  const cats = Object.keys(sum.categories);
  state.settings.categories = state.settings.categories.filter((c) => cats.includes(c));
  $('categoryChips').replaceChildren(...cats.map((c) => el('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(state.settings.categories.includes(c)),
    text: `${c} · ${sum.categories[c]}`,
    onclick: () => {
      const list = state.settings.categories;
      const i = list.indexOf(c);
      if (i === -1) list.push(c); else list.splice(i, 1);
      saveState();
      renderHome();
    },
  })));

  const form = $('settingsForm');
  const s = state.settings;
  for (const key of ['difficulty', 'rounds', 'perRound', 'timePerQuestion', 'seed']) form.elements[key].value = s[key];
  form.elements.passThreshold.value = String(s.passThreshold);
  for (const key of ['shuffleQuestions', 'shuffleOptions', 'lifelines']) form.elements[key].checked = s[key];
  updatePoolInfo();
}

function readSettings() {
  const f = $('settingsForm').elements;
  const int = (v, min, max, def) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  Object.assign(state.settings, {
    difficulty: f.difficulty.value,
    rounds: int(f.rounds.value, 1, 20, 3),
    perRound: int(f.perRound.value, 1, 100, 5),
    timePerQuestion: int(f.timePerQuestion.value, 0, 600, 20),
    passThreshold: Number(f.passThreshold.value),
    seed: f.seed.value.trim(),
    shuffleQuestions: f.shuffleQuestions.checked,
    shuffleOptions: f.shuffleOptions.checked,
    lifelines: f.lifelines.checked,
  });
  saveState();
  return state.settings;
}

function poolSize(s) {
  return questionsOf(activeSet()).filter((q) =>
    (!s.categories.length || s.categories.includes(q.category)) &&
    (!['1', '2', '3'].includes(String(s.difficulty)) || q.difficulty === Number(s.difficulty))).length;
}

function updatePoolInfo() {
  const s = readSettings();
  const pool = poolSize(s);
  const play = Math.min(pool, s.rounds * s.perRound);
  const rounds = Math.min(s.rounds, play);
  $('poolInfo').textContent = pool
    ? `${pool} тохирох асуултаас ${play} асуулт · ${rounds} тойрог${play < s.rounds * s.perRound ? ' (асуулт хүрэлцэхгүй тул багасгав)' : ''}`
    : 'Шүүлтүүрт тохирох асуулт алга';
}

// ---------- game ----------

let game = null;
let selected = new Set();
let timer = { id: null, start: 0 };

function startGame() {
  const s = readSettings();
  const name = $('playerName').value.trim();
  state.profile.name = name;
  saveState();
  try {
    game = createGame(questionsOf(activeSet()), {
      rounds: s.rounds,
      perRound: s.perRound,
      categories: s.categories,
      difficulty: ['1', '2', '3'].includes(String(s.difficulty)) ? Number(s.difficulty) : s.difficulty,
      shuffleQuestions: s.shuffleQuestions,
      shuffleOptions: s.shuffleOptions,
      timePerQuestion: s.timePerQuestion,
      passThreshold: s.passThreshold,
      lifelines: s.lifelines ? DEFAULT_CONFIG.lifelines : { fifty: 0, skip: 0, time: 0 },
      seed: s.seed || null,
    });
  } catch (e) {
    toast(e.message);
    return;
  }
  $('review').classList.add('hidden');
  $('confetti').replaceChildren();
  show('quiz');
  renderQuestion();
}

function abandonGame() {
  stopTimer();
  game = null;
}

function renderHud() {
  $('hudRound').textContent = `${game.roundIndex + 1}/${game.rounds.length}`;
  $('hudQ').textContent = `${game.position}/${game.totalQuestions}`;
  $('hudScore').textContent = game.score.toLocaleString();
  $('hudStreak').textContent = game.streak;
  $('hudStreakWrap').classList.toggle('hot', game.streak >= 3);
  const done = game.position - (game.status === 'question' ? 1 : 0);
  $('progressFill').style.width = pct(done / game.totalQuestions);
}

function renderLifelines() {
  const l = game.lifelines;
  const q = game.current;
  const open = game.status === 'question';
  const set = (id, count, enabled) => {
    const b = $(id);
    b.querySelector('small').textContent = `×${count}`;
    b.disabled = !open || count <= 0 || !enabled;
    b.classList.toggle('hidden', game.config.lifelines[id === 'llFifty' ? 'fifty' : id === 'llTime' ? 'time' : 'skip'] <= 0);
  };
  set('llFifty', l.fifty, q.type === 'single' && q.options.length >= 3 && game.hidden.length === 0);
  set('llTime', l.time, game.timeLimit > 0);
  set('llSkip', l.skip, true);
}

function renderQuestion() {
  const q = game.current;
  selected = new Set();
  renderHud();

  $('qCategory').textContent = q.category;
  const diff = $('qDifficulty');
  diff.textContent = `${DIFF_LABEL[q.difficulty]} · ${q.points} оноо`;
  diff.dataset.level = q.difficulty;
  $('qType').textContent = TYPE_LABEL[q.type];
  $('qText').textContent = q.question;
  $('feedback').classList.add('hidden');
  $('feedback').className = 'feedback hidden';

  const textForm = $('textForm');
  const options = $('options');
  textForm.classList.toggle('hidden', q.type !== 'text');
  textForm.className = q.type === 'text' ? 'text-answer' : 'text-answer hidden';
  $('submitMulti').classList.toggle('hidden', q.type !== 'multiple');
  $('submitMulti').disabled = true;

  if (q.type === 'text') {
    options.replaceChildren();
    const input = $('textInput');
    input.value = '';
    input.disabled = false;
    textForm.querySelector('button').disabled = false;
    setTimeout(() => input.focus(), 50);
  } else {
    options.replaceChildren(...q.options.map((o, i) => el('button', {
      type: 'button', class: 'option', 'data-id': o.id, style: `animation-delay:${i * 45}ms`,
      onclick: () => pickOption(o.id),
    }, el('span', { class: 'key', text: i < 9 ? String(i + 1) : '•' }), el('span', { text: o.text }))));
  }
  renderLifelines();
  startTimer();
}

function pickOption(id) {
  if (!game || game.status !== 'question' || game.hidden.includes(id)) return;
  if (game.current.type === 'multiple') {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    document.querySelectorAll('.option').forEach((b) => b.classList.toggle('selected', selected.has(b.dataset.id)));
    $('submitMulti').disabled = selected.size === 0;
    return;
  }
  submit(id);
}

function currentResponse() {
  const q = game.current;
  if (q.type === 'multiple') return selected.size ? [...selected] : null;
  if (q.type === 'text') return $('textInput').value.trim() || null;
  return null;
}

function submit(response) {
  if (!game || game.status !== 'question') return;
  const elapsed = Math.min(elapsedSeconds(), game.timeLimit || Infinity);
  stopTimer();
  const result = game.answer(response, elapsed);
  reveal(result);
}

function reveal(result) {
  const q = game.current;
  const picked = new Set(Array.isArray(result.response) ? result.response : [result.response]);
  document.querySelectorAll('.option').forEach((b) => {
    const id = b.dataset.id;
    const isCorrect = q.correctIds.includes(id);
    b.disabled = true;
    b.classList.remove('selected');
    if (isCorrect) b.classList.add(picked.has(id) || q.type !== 'multiple' ? 'correct' : 'missed');
    else if (picked.has(id)) b.classList.add('wrong');
  });
  if (q.type === 'text') {
    $('textInput').disabled = true;
    $('textForm').querySelector('button').disabled = true;
    $('textForm').classList.add(result.correct ? 'correct' : 'wrong');
  }
  $('submitMulti').classList.add('hidden');

  const fb = $('feedback');
  let title;
  if (result.skipped) { title = '⏭ Алгаслаа'; fb.className = 'feedback skip'; }
  else if (result.correct) { title = ['✅ Зөв!', '🎯 Гайхалтай!', '🔥 Яг тааллаа!'][Math.min(2, Math.floor(result.streak / 3))]; fb.className = 'feedback good'; }
  else if (result.partial) { title = '🟡 Хэсэгчлэн зөв'; fb.className = 'feedback partial'; }
  else if (result.timedOut) { title = '⏰ Хугацаа дууслаа'; fb.className = 'feedback bad'; }
  else { title = '❌ Буруу'; fb.className = 'feedback bad'; }
  $('fbTitle').textContent = title;

  const b = result.breakdown;
  const parts = [];
  if (b && result.points > 0) {
    const detail = [`суурь ${b.base}`];
    if (b.timeBonus) detail.push(`хурд +${b.timeBonus}`);
    if (b.multiplier > 1) detail.push(`цуврал ×${b.multiplier}`);
    if (b.penalty < 1) detail.push('50/50 ×0.5');
    parts.push(`+${result.points} оноо (${detail.join(', ')})`);
  } else if (!result.skipped) parts.push('0 оноо');
  if (!result.correct) {
    const answer = q.type === 'text' ? q.accepted[0] : q.options.filter((o) => q.correctIds.includes(o.id)).map((o) => o.text).join(', ');
    parts.push(`Зөв хариулт: ${answer}`);
  }
  $('fbPoints').textContent = parts.join(' · ');
  $('fbExpl').textContent = q.explanation || '';
  $('nextBtn').textContent = game.questionIndex === game.rounds[game.roundIndex].length - 1
    ? (game.isLastRound ? 'Үр дүн харах ↵' : 'Тойрог дуусгах ↵')
    : 'Дараах ↵';
  fb.classList.remove('hidden');
  renderHud();
  renderLifelines();
  setTimeout(() => $('nextBtn').focus({ preventScroll: true }), 30);
}

function goNext() {
  if (!game || game.status !== 'answered') return;
  const stats = game.next();
  if (!stats) { renderQuestion(); return; }
  if (game.status === 'finished') finish(stats);
  else showRoundEnd(stats);
}

function showRoundEnd(stats) {
  $('roundEyebrow').textContent = `Тойрог ${stats.round + 1} / ${game.rounds.length} дууслаа`;
  $('roundTitle').textContent = stats.accuracy === 1 ? 'Төгс тойрог! 🏆' : stats.accuracy >= 0.7 ? 'Сайн байна! 💪' : 'Давлаа, үргэлжлүүлье! 👍';
  $('rCorrect').textContent = `${stats.correct}/${stats.answered}`;
  $('rPoints').textContent = stats.points.toLocaleString();
  $('rAcc').textContent = pct(stats.accuracy);
  const bonus = $('rBonus');
  bonus.classList.toggle('hidden', !stats.bonus);
  bonus.textContent = `Төгс тойргийн шагнал +${stats.bonus}`;
  const nextRound = game.rounds[stats.round + 1];
  const maxDiff = Math.max(...nextRound.map((q) => q.difficulty));
  $('rNext').textContent = `Дараагийн тойрог: ${nextRound.length} асуулт · ${DIFF_LABEL[maxDiff]} хүртэл`;
  if (stats.bonus) confetti(40);
  show('round');
  $('nextRoundBtn').focus({ preventScroll: true });
}

function nextRound() {
  if (!game || game.status !== 'round-end') return;
  game.startNextRound();
  show('quiz');
  renderQuestion();
}

function finish(lastStats) {
  stopTimer();
  const res = game.results();
  const p = state.profile;
  const before = levelInfo(p.xp);
  const xpGain = res.score + (res.completed ? 100 : 0);
  p.xp += xpGain;
  p.games += 1;
  p.best = Math.max(p.best, res.score);
  p.correct += res.correct;
  p.answered += res.answered;
  const after = levelInfo(p.xp);

  state.board.push({
    name: p.name || 'Нэргүй', score: res.score, accuracy: res.accuracy, grade: res.grade,
    set: activeSet().name, questions: res.answered + res.skipped, date: new Date().toISOString(), completed: res.completed,
  });
  state.board.sort((a, b) => b.score - a.score);
  state.board = state.board.slice(0, 20);
  saveState();

  $('resStatus').textContent = res.failed
    ? `Тойрог ${lastStats.round + 1}-д ${pct(game.config.passThreshold)}-ийн босгыг давсангүй`
    : 'Бүх тойргийг амжилттай давлаа';
  $('resGrade').textContent = res.grade;
  $('resScore').textContent = res.score.toLocaleString();
  $('resCorrect').textContent = `${res.correct}/${res.answered}`;
  $('resAcc').textContent = pct(res.accuracy);
  $('resStreak').textContent = res.bestStreak;
  $('resTime').textContent = `${res.avgTime.toFixed(1)}с`;
  const xp = $('resXp');
  xp.replaceChildren(`+${xpGain.toLocaleString()} XP${res.completed ? ' (дуусгасны +100 орсон)' : ''}`);
  if (after.level > before.level) xp.append(el('div', { class: 'lvl-up', text: `⬆ Түвшин ахилаа: ${after.level} · ${after.title}` }));
  $('resRounds').replaceChildren(...res.rounds.map((r) => el('div', { class: r.passed === false || (res.failed && r.round === lastStats.round) ? 'fail' : '' },
    el('span', { text: `Тойрог ${r.round + 1}` }),
    el('span', { text: `${r.correct}/${r.answered} зөв · ${r.points.toLocaleString()} оноо${r.bonus ? ' 🏆' : ''}` }))));
  renderReview();
  show('results');
  if (['S', 'A'].includes(res.grade) && !res.failed) confetti(after.level > before.level ? 160 : 100);
  else if (after.level > before.level) confetti(80);
}

function renderReview() {
  const byId = new Map(game.rounds.flat().map((q) => [q.id, q]));
  $('review').replaceChildren(...game.log.map((e, i) => {
    const q = byId.get(e.questionId);
    const textOf = (ids) => q.options.filter((o) => ids.includes(o.id)).map((o) => o.text).join(', ');
    const correct = q.type === 'text' ? q.accepted.join(' / ') : textOf(q.correctIds);
    let given = '—';
    if (e.skipped) given = 'алгассан';
    else if (e.response !== null && e.response !== undefined) given = q.type === 'text' ? e.response : textOf([].concat(e.response));
    else given = 'хугацаа дууссан';
    const cls = e.correct ? 'ok' : e.skipped ? 'skip' : e.partial ? 'part' : '';
    return el('div', { class: `review-item ${cls}` },
      el('div', { class: 'rq', text: `${i + 1}. ${q.question}` }),
      el('div', { class: 'ra', text: `Таны хариулт: ${given} · Зөв: ${correct} · ${e.points} оноо` }),
      q.explanation ? el('div', { class: 'ra', text: q.explanation }) : null);
  }));
}

// ---------- timer ----------

const RING = 2 * Math.PI * 19;

function elapsedSeconds() { return (performance.now() - timer.start) / 1000; }

function startTimer() {
  stopTimer();
  timer.start = performance.now();
  tick();
  timer.id = setInterval(tick, 100);
}

function stopTimer() {
  clearInterval(timer.id);
  timer.id = null;
}

function tick() {
  const box = $('timer');
  const limit = game?.timeLimit || 0;
  box.classList.toggle('off', !limit);
  if (!limit || game.status !== 'question') return;
  const left = Math.max(0, limit - elapsedSeconds());
  $('timerText').textContent = Math.ceil(left);
  $('timerRing').style.strokeDashoffset = String(RING * (1 - left / limit));
  box.classList.toggle('warn', left <= limit * 0.5 && left > limit * 0.25);
  box.classList.toggle('danger', left <= limit * 0.25);
  if (left <= 0) submit(currentResponse()); // time is up: submit whatever is selected/typed
}

// ---------- data manager ----------

let editingId = null;

const JSON_TEMPLATE = JSON.stringify([
  { category: 'Жишээ', difficulty: 'easy', question: 'Монголын нийслэл?', options: ['Дархан', 'Улаанбаатар', 'Эрдэнэт'], answer: 'Улаанбаатар', explanation: 'Тайлбар заавал биш' },
  { category: 'Жишээ', difficulty: 2, question: 'Аль нь тэгш тоо вэ?', options: ['2', '3', '4'], answer: ['2', '4'] },
  { category: 'Жишээ', difficulty: 'hard', question: 'Дэлхий нарыг тойрон эргэдэг.', answer: true },
  { category: 'Жишээ', question: '2 + 2 = ?', type: 'text', answer: ['4', 'дөрөв'], time: 10 },
], null, 2);

const CSV_TEMPLATE = [
  'question,options,answer,difficulty,category,type,explanation',
  'Монголын нийслэл?,Дархан|Улаанбаатар|Эрдэнэт,Улаанбаатар,easy,Жишээ,,',
  'Аль нь тэгш тоо вэ?,2|3|4,2|4,medium,Жишээ,multiple,',
  'Дэлхий нарыг тойрон эргэдэг.,,true,hard,Жишээ,boolean,',
  '"2 + 2 = ?",,4|дөрөв,1,Жишээ,text,"Таслал агуулсан текстийг ""хашилтад"" бичнэ"',
].join('\n');

function renderData() {
  $('setList').replaceChildren(...allSets().map((s) => {
    const n = questionsOf(s).length;
    return el('div', { class: `set-item${s.id === state.activeSetId ? ' active' : ''}` },
      el('div', {}, el('div', { class: 'name', text: s.name }), el('div', { class: 'muted small', text: `${n} асуулт${s.builtin ? ' · үндсэн' : ''}` })),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn primary', type: 'button', text: s.id === state.activeSetId ? 'Идэвхтэй' : 'Ашиглах', disabled: s.id === state.activeSetId, onclick: () => { state.activeSetId = s.id; state.settings.categories = []; saveState(); renderData(); toast(`"${s.name}" идэвхжлээ`); } }),
        el('button', { class: 'btn ghost', type: 'button', text: s.builtin ? 'Хуулж засах' : 'Засах', onclick: () => editSet(s) }),
        el('button', { class: 'btn ghost', type: 'button', text: 'Татах', onclick: () => exportSet(s) }),
        s.builtin ? null : el('button', { class: 'btn ghost danger', type: 'button', text: 'Устгах', onclick: () => deleteSet(s) })));
  }));
  $('editorTitle').textContent = editingId ? 'Сан засах' : 'Шинэ сан';
}

function editSet(s) {
  editingId = s.builtin ? null : s.id;
  $('setName').value = s.builtin ? `${s.name} (хуулбар)` : s.name;
  $('dataInput').value = s.builtin ? JSON.stringify(questionsOf(s).map(toPortable), null, 2) : s.text;
  validateEditor();
  renderData();
  $('setName').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteSet(s) {
  if (!confirm(`"${s.name}" санг устгах уу?`)) return;
  state.sets = state.sets.filter((x) => x.id !== s.id);
  if (state.activeSetId === s.id) state.activeSetId = SAMPLE_ID;
  if (editingId === s.id) newSet();
  saveState();
  renderData();
}

function exportSet(s) {
  const data = JSON.stringify({ name: s.name, questions: questionsOf(s).map(toPortable) }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = el('a', { href: url, download: `${s.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function newSet() {
  editingId = null;
  $('setName').value = '';
  $('dataInput').value = '';
  $('validation').replaceChildren();
  renderData();
}

function validateEditor() {
  const { questions, errors } = parseInput($('dataInput').value);
  const box = $('validation');
  const nodes = [];
  if (questions.length) {
    const sum = summarizeQuestions(questions);
    const cats = Object.entries(sum.categories).map(([c, n]) => `${c} ${n}`).join(', ');
    nodes.push(el('div', { class: 'ok', text: `✔ ${questions.length} зөв асуулт · ${cats}` }));
  }
  if (errors.length) {
    nodes.push(el('div', { text: `⚠ ${errors.length} алдаа:` }));
    nodes.push(el('ul', {}, errors.slice(0, 50).map((e) => el('li', { text: e }))));
  }
  box.replaceChildren(...nodes);
  return { questions, errors };
}

function saveEditor() {
  const { questions, errors } = validateEditor();
  if (!questions.length) { toast('Хадгалах зөв асуулт алга'); return; }
  if (errors.length && !confirm(`${errors.length} алдаатай мөр хасагдаж, ${questions.length} асуулт хадгалагдана. Үргэлжлүүлэх үү?`)) return;
  const name = $('setName').value.trim() || `Миний сан ${state.sets.length + 1}`;
  // Store the cleaned, normalised data so invalid rows never come back.
  const text = JSON.stringify(questions.map(toPortable));
  if (editingId) {
    const s = state.sets.find((x) => x.id === editingId);
    Object.assign(s, { name, text });
  } else {
    editingId = `set-${Date.now().toString(36)}`;
    state.sets.push({ id: editingId, name, text });
  }
  state.activeSetId = editingId;
  state.settings.categories = [];
  saveState();
  renderData();
  toast(`"${name}" хадгалагдаж, идэвхжлээ`);
}

function loadFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let text = String(reader.result);
    try { // exported files are { name, questions } — pick the name up too
      const obj = JSON.parse(text);
      if (obj && !Array.isArray(obj) && obj.name && !$('setName').value) $('setName').value = obj.name;
    } catch { /* CSV or invalid JSON: validation reports it */ }
    if (!$('setName').value) $('setName').value = file.name.replace(/\.[^.]+$/, '');
    $('dataInput').value = text;
    validateEditor();
  };
  reader.onerror = () => toast('Файл уншиж чадсангүй');
  reader.readAsText(file);
}

// ---------- leaderboard ----------

function renderBoard() {
  const list = $('board');
  if (!state.board.length) {
    list.replaceChildren(el('li', { class: 'empty', text: 'Одоохондоо тоглолт алга. Эхний байрыг эзлээрэй!' }));
    return;
  }
  list.replaceChildren(...state.board.map((e) => el('li', {},
    el('div', {},
      el('div', { class: 'who', text: `${e.name} · ${e.grade}` }),
      el('div', { class: 'meta', text: `${e.set} · ${e.questions} асуулт · ${pct(e.accuracy)} · ${new Date(e.date).toLocaleDateString()}${e.completed ? '' : ' · дуусаагүй'}` })),
    el('div', { class: 'pts', text: e.score.toLocaleString() }))));
}

// ---------- effects ----------

function confetti(count) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('confetti');
  const colors = ['#7c5cff', '#20d3c2', '#ffb547', '#ff5c7a', '#2ed47a'];
  for (let i = 0; i < count; i++) {
    box.append(el('i', { style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-duration:${2 + Math.random() * 2}s;animation-delay:${Math.random() * 0.4}s;transform:rotate(${Math.random() * 360}deg)` }));
  }
  setTimeout(() => box.replaceChildren(), 4600);
}

// ---------- wiring ----------

function bind() {
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
  $('themeToggle').addEventListener('click', () => {
    const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    state.theme = dark ? 'light' : 'dark';
    applyTheme();
    saveState();
  });

  $('playerName').addEventListener('change', (e) => { state.profile.name = e.target.value.trim(); saveState(); });
  $('setSelect').addEventListener('change', (e) => { state.activeSetId = e.target.value; state.settings.categories = []; saveState(); renderHome(); });
  $('settingsForm').addEventListener('input', updatePoolInfo);
  $('settingsForm').addEventListener('submit', (e) => { e.preventDefault(); startGame(); });

  $('submitMulti').addEventListener('click', () => { if (selected.size) submit([...selected]); });
  $('textForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('textInput').value.trim(); if (v) submit(v); });
  $('nextBtn').addEventListener('click', goNext);
  $('nextRoundBtn').addEventListener('click', nextRound);
  $('llFifty').addEventListener('click', () => {
    const hidden = game?.useFifty();
    if (!hidden) return;
    hidden.forEach((id) => { const b = document.querySelector(`.option[data-id="${CSS.escape(id)}"]`); if (b) { b.classList.add('eliminated'); b.disabled = true; } });
    renderLifelines();
  });
  $('llTime').addEventListener('click', () => { if (game?.useExtraTime()) { toast('+15 секунд'); renderLifelines(); tick(); } });
  $('llSkip').addEventListener('click', () => {
    if (!game || game.status !== 'question') return;
    stopTimer();
    const r = game.skip();
    if (r) reveal(r); else startTimer();
  });
  $('quitBtn').addEventListener('click', () => show('home'));
  $('againBtn').addEventListener('click', () => { game = null; startGame(); });
  $('reviewBtn').addEventListener('click', () => { const r = $('review'); r.classList.toggle('hidden'); if (!r.classList.contains('hidden')) r.scrollIntoView({ behavior: 'smooth' }); });

  $('validateBtn').addEventListener('click', validateEditor);
  $('saveSetBtn').addEventListener('click', saveEditor);
  $('newSetBtn').addEventListener('click', newSet);
  $('tplJson').addEventListener('click', () => { $('dataInput').value = JSON_TEMPLATE; validateEditor(); });
  $('tplCsv').addEventListener('click', () => { $('dataInput').value = CSV_TEMPLATE; validateEditor(); });
  $('fileInput').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
  $('clearBoard').addEventListener('click', () => { if (confirm('Тэргүүлэгчдийн жагсаалтыг цэвэрлэх үү?')) { state.board = []; saveState(); renderBoard(); } });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (currentScreen === 'round' && e.key === 'Enter') { e.preventDefault(); nextRound(); return; }
    if (currentScreen !== 'quiz' || !game) return;
    if (game.status === 'answered' && e.key === 'Enter') { e.preventDefault(); goNext(); return; }
    if (game.status !== 'question' || e.target instanceof HTMLInputElement) return;
    const q = game.current;
    if (/^[1-9]$/.test(e.key) && q.options[Number(e.key) - 1]) { e.preventDefault(); pickOption(q.options[Number(e.key) - 1].id); }
    else if (e.key === 'Enter' && q.type === 'multiple' && selected.size) { e.preventDefault(); submit([...selected]); }
  });
}

applyTheme();
bind();
renderHome();
