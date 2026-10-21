// Visual QA: drives the built web app in Chromium and saves screenshots of every screen.
// Needs the API on API_URL (migrated + seeded) and the built web app on WEB_URL (`vite preview`).
// Usage: node e2e/screenshots.mjs [outDir]
import { mkdir } from 'node:fs/promises';
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
  const file = `${OUT}/${String(shots.length + 1).padStart(2, '0')}-${name}.png`;
  await page.waitForTimeout(400); // let transitions settle
  await page.screenshot({ path: file, fullPage });
  shots.push(file);
  console.log('📸', file);
}

/** Records console errors, failed requests and horizontal overflow on every page. */
function watch(page, label) {
  page.on('pageerror', (e) => problems.push(`${label}: page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`${label}: console: ${m.text()}`));
  page.on('requestfailed', (r) => problems.push(`${label}: request failed: ${r.url()} ${r.failure()?.errorText}`));
}

async function checkOverflow(page, label) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 1) problems.push(`${label}: horizontal overflow of ${over}px`);
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
        ],
      },
    ],
  }),
}).then((r) => r.json());
const game = await fetch(`${API}/api/games`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ quizId: quiz.id, visibility: 'public' }),
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
  await p.getByLabel('Хоч нэр').fill(name);
  await p.getByRole('button', { name: 'Эхэлцгээе!' }).click();
  await p.waitForURL('**/play/**');
  await p.waitForLoadState('networkidle');
  players.push(p);
}
await shot(players[0], 'game-player-lobby');
await shot(host, 'game-host-lobby');

await host.getByRole('button', { name: 'Тоглоом эхлүүлэх' }).click();
await host.waitForTimeout(600);
await shot(host, 'game-host-countdown');

const HOST_NEXT = ['Дараагийн асуулт', 'Дараагийн тойрог', 'Үр дүн харах', 'Үргэлжлүүлэх'];
let question = 0;
for (let step = 0; step < 60; step++) {
  // Players answer whatever is on screen.
  const form = players[0].locator('form').first();
  if (await form.locator('button:enabled, input:enabled').count()) {
    question++;
    await shot(host, `game-host-question-${question}`);
    await shot(players[0], `game-player-question-${question}`);
    for (const p of players) {
      const f = p.locator('form').first();
      if (await f.locator('#typed-answer').count()) {
        await f.locator('#typed-answer').fill(p === players[2] ? '45' : '40');
        await f.getByRole('button', { name: 'Илгээх' }).click();
      } else if (await f.locator('[aria-pressed]').count()) {
        await f.locator('[aria-pressed]').first().click();
        await f.locator('[aria-pressed]').nth(1).click();
        await f.getByRole('button', { name: 'Илгээх' }).click();
      } else if ((await f.locator('button').count()) === 1 || (await f.getByRole('button', { name: 'Илгээх' }).count())) {
        await f.getByRole('button', { name: 'Илгээх' }).click();
      } else {
        await f.locator('button').nth(p === players[1] ? 1 : 0).click();
      }
    }
    await players[0].waitForTimeout(300);
    if (question === 1) await shot(players[0], 'game-player-answered');
    await host.waitForTimeout(2000); // reveal follows shortly after everyone answers
  }

  const next = HOST_NEXT.map((n) => host.getByRole('button', { name: n, exact: true }));
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
    await host.waitForTimeout(700);
  }
}
await host.waitForTimeout(4000); // podium reveals 3rd, 2nd, then 1st
await shot(host, 'game-host-podium', true);
await shot(players[0], 'game-player-podium', true);
await checkOverflow(players[0], 'player podium');

await browser.close();
console.log(`\n${shots.length} screenshots in ${OUT}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of [...new Set(problems)]) console.log(' -', p);
}
