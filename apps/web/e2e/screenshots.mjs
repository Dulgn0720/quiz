// Visual QA: drives the built web app in Chromium and saves screenshots of every screen.
// Needs the API on API_URL (migrated + seeded) and the built web app on WEB_URL (`vite preview`).
// Usage: node e2e/screenshots.mjs [outDir]
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, devices } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? 'screenshots';
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const PHONE = { ...devices['iPhone 13'], deviceScaleFactor: 2 };
const shots = [];
const problems = [];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

async function shot(page, name, fullPage = false) {
  const file = `${OUT}/${String(shots.length + 1).padStart(2, '0')}-${name}.jpg`;
  await page.waitForTimeout(400); // let transitions settle
  await page.screenshot({ path: file, fullPage, type: 'jpeg', quality: 72 });
  shots.push(file);
  console.log('📸', file);
}

/** Records console errors, failed requests and horizontal overflow on every page. */
function watch(page, label) {
  page.on('pageerror', (e) => problems.push(`${label}: page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`${label}: console: ${m.text()}`));
  page.on('requestfailed', (r) => problems.push(`${label}: request failed: ${r.url()} ${r.failure()?.errorText}`));
}

/** Flags the page if anything sticks out past the right edge (what makes phones scroll sideways). */
async function checkOverflow(page, label) {
  const offenders = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= width + 1) continue;
      // Skip children of something already reported, and things clipped by a scroll container.
      if (out.some((o) => o.el.contains(el))) continue;
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') {
          clipped = true;
          break;
        }
      }
      if (!clipped) out.push({ el, desc: `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')} (+${Math.round(r.right - width)}px)` });
    }
    return out.slice(0, 3).map((o) => o.desc);
  });
  if (offenders.length) problems.push(`${label}: overflows the screen: ${offenders.join(', ')}`);
}

async function newPage(options, theme, label) {
  const context = await browser.newContext({ ...options, locale: 'mn-MN' });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('quiz-pro:theme', t);
    } catch {}
  }, theme);
  const page = await context.newPage();
  watch(page, label);
  return page;
}

// ---- Static pages, desktop and phone, light and dark ----
const pages = [
  ['home', '/'],
  ['quizzes', '/quizzes'],
  ['rooms', '/rooms'],
  ['leaderboard', '/leaderboard'],
  ['join', '/join'],
  ['login', '/login'],
  ['register', '/register'],
  ['editor', '/quizzes/agula-yos-zuin-durem/edit'],
  ['new-quiz', '/quizzes/new'],
  ['not-found', '/nope'],
];
for (const [device, options] of [
  ['desktop', DESKTOP],
  ['phone', PHONE],
]) {
  for (const theme of ['light', 'dark']) {
    const page = await newPage(options, theme, `${device}-${theme}`);
    for (const [name, path] of pages) {
      if (theme === 'dark' && !['home', 'quizzes', 'editor', 'join'].includes(name)) continue;
      await page.goto(WEB + path, { waitUntil: 'networkidle' });
      await checkOverflow(page, `${device}-${theme} ${name}`);
      await shot(page, `${device}-${theme}-${name}`, name === 'home' || name === 'quizzes');
    }
    await page.context().close();
  }
}

// ---- Signed-in profile ----
{
  const page = await newPage(DESKTOP, 'light', 'profile');
  await page.goto(`${WEB}/register`, { waitUntil: 'networkidle' });
  await page.getByLabel('Харагдах нэр').fill('Туршилт');
  await page.getByLabel('Имэйл').fill(`qa${Date.now()}@example.com`);
  await page.getByLabel('Нууц үг').fill('qa-password-123');
  await page.getByRole('button', { name: 'Бүртгүүлэх' }).click();
  await page.waitForURL('**/me');
  await page.waitForLoadState('networkidle');
  await shot(page, 'desktop-light-profile', true);
  await page.context().close();
}

// ---- Solo practice on a phone ----
{
  const page = await newPage(PHONE, 'dark', 'practice');
  await page.goto(`${WEB}/practice/agula-yos-zuin-durem`, { waitUntil: 'networkidle' });
  await shot(page, 'practice-intro');
  await checkOverflow(page, 'practice intro');
  await page.getByRole('button', { name: /Эхлэх/ }).click();
  await page.waitForTimeout(3600); // get-ready countdown
  await shot(page, 'practice-question');
  await checkOverflow(page, 'practice question');
  const form = page.locator('form');
  const textbox = form.getByRole('textbox');
  if (await textbox.count()) {
    await textbox.fill('туршилт');
    await textbox.press('Enter');
  } else {
    // Ordering can be sent as is; choice questions need a tile first.
    const submit = form.getByRole('button', { name: /Илгээх/ });
    if ((await submit.count()) && (await submit.isEnabled())) await submit.click();
    else {
      await form.getByRole('button').first().click();
      if (await submit.count()) await submit.click();
    }
  }
  await page.getByRole('button', { name: /Дараагийн асуулт|Дүнгээ харах/ }).waitFor({ timeout: 5000 });
  await shot(page, 'practice-reveal', true);
  await checkOverflow(page, 'practice reveal');
  await page.context().close();
}

// ---- Survival on a phone ----
{
  const page = await newPage(PHONE, 'dark', 'survival');
  await page.goto(`${WEB}/survival`, { waitUntil: 'networkidle' });
  await shot(page, 'survival-intro');
  await page.getByRole('button', { name: /Эхлэх/ }).click();
  await page.locator('form').first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  await shot(page, 'survival-question');
  await checkOverflow(page, 'survival question');
  await page.context().close();
}

// ---- «Үг таах» on a phone: three guesses, then the hint ----
{
  const page = await newPage(PHONE, 'dark', 'word-game');
  await page.goto(`${WEB}/word`, { waitUntil: 'networkidle' });
  await shot(page, 'word-game-empty');
  for (const guess of ['гэрэл', 'намар', 'ширээ']) {
    for (const letter of guess) await page.getByRole('button', { name: letter, exact: true }).click();
    await page.getByRole('button', { name: /Шалгах/ }).click();
    await page.waitForTimeout(900);
  }
  await shot(page, 'word-game-guesses');
  await checkOverflow(page, 'word game');
  const hint = page.getByRole('button', { name: /Сэжүүр/ });
  if (await hint.isVisible().catch(() => false)) await hint.click();
  await shot(page, 'word-game-hint');
  await page.context().close();
}

// ---- A live game: host on a projector, three players on phones ----
const quiz = await fetch(`${API}/api/quizzes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Agula · Харагдах байдлын шалгалт',
    rounds: [
      {
        name: 'Халаалт',
        timePerQuestion: 15,
        questions: [
          {
            type: 'single',
            prompt: 'Нууц үгээ хэдэн удаа буруу оруулбал бүртгэл түр түгжигдэх вэ?',
            options: [
              { id: 'a', text: '3 удаа' },
              { id: 'b', text: '5 удаа' },
              { id: 'c', text: '10 удаа' },
              { id: 'd', text: 'Түгжигдэхгүй' },
            ],
            correct: ['b'],
            explanation: 'IT-05, 16.2-т буруу оролдлогын дээд тоог таваар тогтооно.',
          },
          { type: 'true_false', prompt: 'Галын үед эхлээд 101 дугаарт мэдэгдэнэ.', correct: true },
        ],
      },
      {
        name: 'Хурдан тойрог',
        type: 'double',
        timePerQuestion: 15,
        questions: [
          {
            type: 'multiple',
            prompt: 'Аль нь хувийн мэдээлэлд хамаарах вэ?',
            options: [
              { id: 'a', text: 'Регистрийн дугаар' },
              { id: 'b', text: 'Утасны дугаар' },
              { id: 'c', text: 'Компанийн лого' },
              { id: 'd', text: 'Байгууллагын хаяг' },
            ],
            correct: ['a', 'b'],
          },
          { type: 'type_answer', prompt: 'Долоо хоногийн ажлын цаг хэд вэ?', acceptedAnswers: ['40'] },
          {
            type: 'ordering',
            prompt: 'Нөхөн төлбөрийн үе шатыг дараалуул.',
            items: [
              { id: '1', text: 'Мэдэгдэл хүлээн авах' },
              { id: '2', text: 'Баримт бүрдүүлэх' },
              { id: '3', text: 'Шийдвэр гаргах' },
              { id: '4', text: 'Төлбөр олгох' },
            ],
          },
          {
            type: 'estimate',
            prompt: 'Ардын хувьсгал хэдэн онд ялсан бэ?',
            answer: 1921,
            min: 1900,
            max: 1950,
            tolerance: 2,
            unit: 'он',
          },
        ],
      },
    ],
  }),
}).then((r) => r.json());
const game = await fetch(`${API}/api/games`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ quizId: quiz.id, visibility: 'public', powerUps: true }),
}).then((r) => r.json());
if (!game.pin) throw new Error(`Could not create a game: ${JSON.stringify(game)}`);

const host = await newPage(DESKTOP, 'light', 'host');
await host.context().addInitScript(([pin, token]) => localStorage.setItem(`quiz-pro:host:${pin}`, token), [game.pin, game.hostToken]);
await host.goto(`${WEB}/host/${game.pin}`, { waitUntil: 'networkidle' });
await shot(host, 'game-host-lobby-empty');

const players = [];
for (const [name, theme] of [
  ['Болд', 'dark'],
  ['Сараа', 'light'],
  ['Тэмүүжин', 'light'],
]) {
  const p = await newPage(PHONE, theme, `player-${name}`);
  await p.goto(`${WEB}/join/${game.pin}`, { waitUntil: 'networkidle' });
  if (players.length === 0) await shot(p, 'game-player-join-form');
  await p.getByLabel('Тоглогчийн нэр').fill(name);
  await p.getByRole('button', { name: 'Нэгдэх', exact: true }).click();
  await p.waitForURL('**/play/**');
  await p.waitForLoadState('networkidle');
  players.push(p);
}
await shot(players[0], 'game-player-lobby');
await checkOverflow(players[0], 'player lobby');
await shot(host, 'game-host-lobby');

// Everyone cheers: enough reactions fill the hype meter on the projector.
for (const p of players) {
  for (let i = 0; i < 5; i++) {
    await p.getByRole('button', { name: / илгээх$/ }).nth(i % 3).click().catch(() => {});
    await p.waitForTimeout(60);
  }
}
await host.waitForTimeout(500);
await shot(host, 'game-host-hype');

await host.getByRole('button', { name: 'Тоглоом эхлүүлэх' }).click();
await host.waitForTimeout(600);
await shot(host, 'game-host-countdown');

const HOST_NEXT = [/^Дараагийн асуулт/, /^Дараагийн тойрог/, /^Үр дүн/, /^Үргэлжлүүлэх/];
let question = 0;
for (let step = 0; step < 60; step++) {
  // Players answer whatever is on screen.
  const form = players[0].locator('form').first();
  if (await form.locator('button:enabled, input:enabled').count()) {
    question++;
    await shot(host, `game-host-question-${question}`);
    await shot(players[0], `game-player-question-${question}`);
    await checkOverflow(players[0], `player question ${question}`);
    if (question === 1) {
      // Bold plays both power-ups on the first question.
      await players[0].getByRole('button', { name: /50\/50/ }).click();
      await players[0].getByRole('button', { name: /Оноо ×2/ }).click();
      await players[0].waitForTimeout(700);
      await shot(players[0], 'game-player-power-ups');
    }
    for (const p of players) {
      const f = p.locator('form').first();
      if (await f.locator('input[type=range]').count()) {
        await f.locator('input[type=range]').fill(String([1921, 1918, 1935][players.indexOf(p)]));
        await f.getByRole('button', { name: 'Илгээх' }).click();
      } else if (await f.locator('#typed-answer').count()) {
        await f.locator('#typed-answer').fill(p === players[2] ? '45' : '40');
        await f.getByRole('button', { name: 'Илгээх' }).click();
      } else if (await f.locator('[aria-pressed]').count()) {
        await f.locator('[aria-pressed]').first().click();
        await f.locator('[aria-pressed]').nth(1).click();
        await f.getByRole('button', { name: 'Илгээх' }).click();
      } else if ((await f.locator('button').count()) === 1 || (await f.getByRole('button', { name: 'Илгээх' }).count())) {
        await f.getByRole('button', { name: 'Илгээх' }).click();
      } else {
        await f.locator('button:enabled').nth(p === players[1] ? 1 : 0).click();
      }
    }
    await players[0].waitForTimeout(300);
    if (question === 1) await shot(players[0], 'game-player-answered');
    await host.waitForTimeout(2000); // reveal follows shortly after everyone answers
  }

  const next = HOST_NEXT.map((n) => host.getByRole('button', { name: n }));
  let clicked = false;
  for (const button of next) {
    if (await button.isVisible().catch(() => false)) {
      await shot(host, `game-host-step-${step}`);
      await shot(players[0], `game-player-step-${step}`);
      await button.click();
      clicked = true;
      await host.waitForTimeout(800);
      break;
    }
  }
  if (!clicked) {
    if (await host.getByText('Эцсийн үр дүн').first().isVisible().catch(() => false)) break;
    if (step % 5 === 0) {
      const names = await host.getByRole('button').allInnerTexts();
      console.log(`step ${step}: host buttons: ${names.map((n) => n.trim()).filter(Boolean).join(' | ')}`);
    }
    await host.waitForTimeout(700);
  }
}
await host.waitForTimeout(6000); // podium reveals 3rd, 2nd, 1st, then the awards
await shot(host, 'game-host-podium', true);
await shot(players[0], 'game-player-podium', true);
await checkOverflow(players[0], 'player podium');

for (const p of [host, ...players]) await p.context().close();

// ---- Trainings: an admin assigns one, an employee takes it, report and certificate ----
{
  const post = (path, body, token) =>
    fetch(`${API}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  const get = (path, token) => fetch(`${API}/api${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const account = (email, displayName) =>
    post('/auth/register', { email, password: 'qa-password-123', displayName }).then((r) =>
      r.token ? r : post('/auth/login', { email, password: 'qa-password-123' }),
    );
  const admin = await account('qa-admin@example.com', 'HR админ');
  const staff = await account(`qa-staff${Date.now()}@example.com`, 'Ану Батболд');
  const training = await post(
    '/trainings',
    { quizId: quiz.id, title: 'Мэдээллийн аюулгүй байдлын сургалт', passPercent: 60, dueDate: '2026-12-31' },
    admin.token,
  );
  if (!training.id) throw new Error(`Could not create a training: ${JSON.stringify(training)}`);

  const asStaff = await newPage(DESKTOP, 'light', 'trainings');
  await asStaff.context().addInitScript((token) => localStorage.setItem('quiz-pro:token', token), staff.token);
  await asStaff.goto(`${WEB}/trainings`, { waitUntil: 'networkidle' });
  await shot(asStaff, 'trainings-list');
  await asStaff.goto(`${WEB}/trainings/${training.id}`, { waitUntil: 'networkidle' });
  await shot(asStaff, 'training-intro');
  await asStaff.getByRole('button', { name: /Эхлэх/ }).click();
  await asStaff.waitForTimeout(500);
  await shot(asStaff, 'training-question');
  for (let i = 0; i < 10; i++) {
    await asStaff.waitForTimeout(400);
    const f = asStaff.locator('form').first();
    if (!(await f.count())) break;
    if (await f.locator('#typed-answer').count()) {
      await f.locator('#typed-answer').fill('40');
      await f.getByRole('button', { name: 'Илгээх' }).click();
    } else if (await f.locator('[aria-pressed]').count()) {
      await f.locator('[aria-pressed]').first().click();
      await f.getByRole('button', { name: 'Илгээх' }).click();
    } else if (await f.getByRole('button', { name: 'Илгээх' }).count()) {
      await f.getByRole('button', { name: 'Илгээх' }).click();
    } else {
      await f.locator('button:enabled').nth(1).click();
    }
    await asStaff.waitForTimeout(800);
  }
  await asStaff.getByText(/Зөв хариулт: \d/).waitFor({ timeout: 8000 });
  await asStaff.waitForTimeout(800);
  await shot(asStaff, 'training-result', true);
  await checkOverflow(asStaff, 'training result');

  // A passing attempt for the certificate: the quiz above has known answers.
  const detail = await get(`/trainings/${training.id}`, staff.token);
  const key = {
    single: { type: 'single', optionIds: ['b'] },
    true_false: { type: 'true_false', value: true },
    multiple: { type: 'multiple', optionIds: ['a', 'b'] },
    type_answer: { type: 'type_answer', text: '40' },
    ordering: { type: 'ordering', itemIds: ['1', '2', '3', '4'] },
    estimate: { type: 'estimate', value: 1921 },
  };
  const pass = await post(
    `/trainings/${training.id}/attempts`,
    { answers: detail.questions.map((q) => ({ questionId: q.id, answer: key[q.type] })) },
    staff.token,
  );
  if (!pass.certificateId) throw new Error(`No certificate: ${JSON.stringify(pass)}`);
  await asStaff.goto(`${WEB}/certificates/${pass.certificateId}`, { waitUntil: 'networkidle' });
  await asStaff.waitForTimeout(1500);
  await shot(asStaff, 'training-certificate');
  await asStaff.context().close();

  const asAdmin = await newPage(DESKTOP, 'light', 'training-report');
  await asAdmin.context().addInitScript((token) => localStorage.setItem('quiz-pro:token', token), admin.token);
  await asAdmin.goto(`${WEB}/trainings`, { waitUntil: 'networkidle' });
  await shot(asAdmin, 'trainings-admin');
  await asAdmin.goto(`${WEB}/trainings/${training.id}/report`, { waitUntil: 'networkidle' });
  await asAdmin.waitForTimeout(1000);
  await shot(asAdmin, 'training-report', true);
  await asAdmin.context().close();

  const phone = await newPage(PHONE, 'dark', 'trainings-phone');
  await phone.context().addInitScript((token) => localStorage.setItem('quiz-pro:token', token), staff.token);
  await phone.goto(`${WEB}/trainings`, { waitUntil: 'networkidle' });
  await shot(phone, 'trainings-phone', true);
  await checkOverflow(phone, 'trainings phone');
  await phone.context().close();
}

await browser.close();
console.log(`\n${shots.length} screenshots in ${OUT}`);
const report = problems.length ? [...new Set(problems)].map((p) => `- ${p}`).join('\n') : 'No problems found.';
console.log(report);
await writeFile(`${OUT}/problems.txt`, report + '\n');
