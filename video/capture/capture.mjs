// Captures the real screens of pHARe for the portfolio video, on the local demo instance (demo-instance.sh up and
// seed.mjs before). On Tuesday 13/10/2026 in Paris, the screens themselves: the login, a new case with three students,
// the history and its search, the team, then the interviews of the pHARe meeting, one of them planned on screen.
//
//   node capture.mjs          (PHARE_WEB_URL=http://127.0.0.2:8000 by default)
//
// - The browser clock is the demo's (context.clock), paused and moved forward step by step. With it paused, the GSAP
//   animations only run when the clock runs: after each page and each action, it runs 2 s or more before a capture.
// - Only requests to 127.0.0.2, the Google fonts and cdnjs (GSAP) pass; the rest is blocked and written to the log.
//   Service workers are blocked: sw.js would answer from its cache, out of the guard's sight.
// - Before each capture, the guard reads the names on screen (the name fields, the member, « Lié à » and
//   « Intervenant » selects, the history, the team window and the rows of the meeting) and stops the run if one is not
//   in the demo data. The footer of the login, with the author's name, belongs to the app. It also checks the API badge
//   (« 🟢 API connectée »), that no toast is showing and that no animation is running.
// - The password field shows dots on screen, and only dots go to text.json and to the log: the password never does.
//
// The captures (2x), manifest.json (the boxes, in CSS px, that the video zooms into) and text.json (the lines of text on
// screen in each capture, for the video to check its edges) go to video/public/phare/; the log, with the time of the
// demo clock at each capture, to ~/phare-captura.log.
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const HOST = '127.0.0.2';
const WEB = (process.env.PHARE_WEB_URL ?? `http://${HOST}:8000`).replace(/\/$/, '');
const DEMO_DIR = process.env.PHARE_DEMO_DIR ?? '/tmp/phare-demo';
const LOG = process.env.PHARE_CAPTURE_LOG ?? join(homedir(), 'phare-captura.log');
const OUT = new URL('../public/phare/', import.meta.url);
const DATA = new URL('../../backend/src/test/resources/demo/phare-demo.json', import.meta.url);
const VIEWPORT = { width: 1440, height: 900 }; // 16:10, like the video
const SCALE = 2;
const ALLOWED = new Set([HOST, 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com']);
if (new URL(WEB).hostname !== HOST) throw new Error(`${WEB}: the capture only runs against the demo instance on ${HOST}`);

const data = JSON.parse(readFileSync(DATA, 'utf8'));
const { date: DAY, zone: ZONE, locale: LOCALE } = data.clock;
const screenCase = data.screenCase;
const people = new Set([...data.team, ...[...data.cases, screenCase].flatMap((c) => c.eleves.map((e) => e.nom))]);

// ── The demo clock ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The instant at which the clock of ZONE reads `date time`. */
function wall(date, time) {
      const guess = new Date(`${date}T${time}Z`);
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
            timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(guess).map((x) => [x.type, x.value]));
      const shown = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
      return new Date(guess.getTime() - (shown.getTime() - guess.getTime()));
}
const plus = (date, seconds) => new Date(date.getTime() + seconds * 1000);
const clockText = (date) => new Intl.DateTimeFormat(LOCALE, { timeZone: ZONE, dateStyle: 'short', timeStyle: 'medium' }).format(date);
const AT = {
      login: wall(DAY, '10:05:00'),
      caso: wall(DAY, '10:08:00'),
      historico: wall(DAY, '10:10:00'),
      busca: wall(DAY, '10:11:00'),
      equipe: wall(DAY, '10:13:00'),
      pendentes: wall(DAY, '10:18:00'),
      agendar: wall(DAY, '10:20:00'),
      planejamento: wall(DAY, '10:21:00'),
};

// ── The log ──────────────────────────────────────────────────────────────────────────────────────────────────────────
let demoNow = AT.login;
writeFileSync(LOG, '');
const log = (line) => {
      const text = `${clockText(demoNow)}  ${line}`;
      console.log(text);
      appendFileSync(LOG, text + '\n');
};
log(`capture of the pHARe demo: ${WEB}, ${VIEWPORT.width}x${VIEWPORT.height} at ${SCALE}x, ${ZONE}, ${LOCALE}`);

// ── The browser ──────────────────────────────────────────────────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const manifestFile = new URL('manifest.json', OUT);
// the names of the data go with the captures: the video checks that no caption nor chip quotes one
const manifest = { viewport: VIEWPORT, scale: SCALE, people: [...people].sort(), shots: {} };

// The form controls (the jj/mm/aaaa of an empty date) follow Chrome's own language, not the context's locale; on Linux,
// Chrome takes it from LANGUAGE and LANG, and ignores --lang.
const [lang, region] = LOCALE.split('-');
const browser = await chromium.launch({
      executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: [`--lang=${LOCALE}`],
      env: { ...process.env, LANGUAGE: `${lang}_${region}:${lang}`, LANG: `${lang}_${region}.UTF-8` },
});
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, timezoneId: ZONE, locale: LOCALE, serviceWorkers: 'block' });
const blocked = [];
const hosts = {};
await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (ALLOWED.has(url.hostname)) {
            hosts[url.hostname] = (hosts[url.hostname] ?? 0) + 1;
            return route.continue();
      }
      blocked.push(url.href);
      log(`blocked ${route.request().method()} ${url.href}`);
      return route.abort('blockedbyclient');
});
await context.clock.install({ time: plus(AT.login, -60) });
await context.clock.pauseAt(AT.login);

const problems = [];
const watch = (page) => {
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') log(`console error: ${message.text()}`); });
      page.on('dialog', async (dialog) => { problems.push(`dialog: ${dialog.message()}`); await dialog.dismiss(); });
      return page;
};

/** Moves the demo clock forward to `to`, firing the timers due on the way (once each). */
async function clockTo(to) {
      if (to < demoNow) throw new Error(`the demo clock cannot go back to ${clockText(to)}`);
      if (to > demoNow) await context.clock.fastForward(to.getTime() - demoNow.getTime());
      demoNow = to;
}
/** Lets the animations and the short timers run: the clock runs `ms`. */
async function settleClock(ms = 2000) {
      await context.clock.runFor(ms);
      demoNow = plus(demoNow, ms / 1000);
}
/** Runs the clock until no GSAP tween is active (the entries take up to 1.5 s). */
async function settleGsap(page) {
      await settleClock(2000);
      for (let i = 0; i < 10; i++) {
            const active = await page.evaluate(() => (typeof gsap === 'undefined' ? 0
                  : gsap.globalTimeline.getChildren(true, true, false).filter((t) => t.isActive()).length));
            if (!active) return;
            await settleClock(500);
      }
      throw new Error('GSAP animations still running after 7 s of demo clock');
}

// ── Before each capture ──────────────────────────────────────────────────────────────────────────────────────────────
/** The fonts loaded, no field focused, the CSS animations finished and the page at the top. */
async function ready(page) {
      await page.evaluate(() => document.fonts.ready);
      // the focus leaves the last field, as after a click elsewhere: no field mid-typing, no selected digits
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      // the CSS animations (.animate-reveal) run on the real clock, not the demo's
      const finished = page.evaluate(() => Promise.all(document.getAnimations()
            .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
            .map((a) => a.finished.catch(() => null))));
      await Promise.race([finished, new Promise((done) => setTimeout(done, 5000))]);
}

/** The guard: stops the run if the screen shows what the video cannot show. */
async function guard(page, name, { formFilled = false } = {}) {
      const seen = await page.evaluate((formFilled) => {
            const visible = (el) => {
                  const r = el.getBoundingClientRect();
                  const s = getComputedStyle(el);
                  return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
            };
            const names = [];
            const add = (where, text) => { const t = (text ?? '').trim(); if (t) names.push({ where, text: t }); };
            // the name fields and the selects of people (their placeholder options aside)
            for (const el of document.querySelectorAll('input[data-field="nom"]')) add('nom', el.value);
            for (const el of document.querySelectorAll('select[data-field="membre"], select[data-field="lie_a"], select.f-membre')) {
                  for (const o of el.options) if (o.value && !o.disabled) add(el.dataset.field ?? 'intervenant', o.text);
            }
            // the history, the team window and the meeting
            for (const row of document.querySelectorAll('#history-list .student-entry')) {
                  const spans = row.querySelectorAll('span');
                  add('history', spans[1]?.textContent);
                  if (spans[2]) add('history member', spans[2].textContent.replace('👤', ''));
            }
            for (const el of document.querySelectorAll('#member-list-items .card span')) add('team', el.textContent);
            for (const el of document.querySelectorAll('.row-student > div')) add('meeting', el.childNodes[0]?.textContent);
            for (const row of document.querySelectorAll('.case-student-row')) {
                  const divs = row.querySelectorAll(':scope > div');
                  add('planning', divs[0]?.textContent);
                  add('planning member', divs[1]?.textContent.replace('👤', ''));
            }
            // and any fictitious-looking name anywhere in these places
            const zones = ['#history-list', '#member-modal', '#cases-container', '#scheduled-grid', '#students-list'];
            const loose = zones.flatMap((z) => [...(document.querySelector(z)?.innerText ?? '').matchAll(/\p{Lu}\p{Ll}+ (?:Exemple|Démo|Fictif|Fictive)/gu)].map((m) => m[0]));
            const badge = document.getElementById('api-status');
            const toast = [...document.querySelectorAll('.toast')].some((el) => el.classList.contains('show') && visible(el));
            const empty = [];
            if (formFilled) {
                  for (const id of ['date', 'heure']) if (!document.getElementById(id).value) empty.push(id);
                  for (const card of document.querySelectorAll('#students-list .student-card')) {
                        for (const el of card.querySelectorAll('input, select')) {
                              if (visible(el) && !el.value) empty.push(`${el.dataset.field} of a student`);
                        }
                  }
            }
            return { names, loose, badge: badge ? badge.textContent.trim() : null, toast, empty };
      }, formFilled);
      const strangers = [...seen.names.filter((n) => !people.has(n.text)).map((n) => `${n.text} (${n.where})`),
            ...seen.loose.filter((n) => !people.has(n))];
      if (strangers.length) throw new Error(`${name}: names on screen that are not in the demo data: ${[...new Set(strangers)].join(', ')}: stop`);
      if (seen.badge !== null && seen.badge !== '🟢 API connectée') throw new Error(`${name}: the API badge says "${seen.badge}": stop`);
      if (seen.toast) throw new Error(`${name}: a toast is on screen`);
      if (seen.empty.length) throw new Error(`${name}: empty fields on screen (${seen.empty.join(', ')})`);
      return seen.names.length;
}

/** The box, in CSS px of the page (scrolled to the top), of the element a function finds. */
async function box(page, find, arg) {
      return page.evaluate(([source, arg]) => {
            // eslint-disable-next-line no-new-func
            const el = new Function('arg', `return (${source})(arg)`)(arg);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
      }, [find.toString(), arg]);
}
/** The box around several elements found by a selector. */
const around = (page, selector) => box(page, (selector) => {
      const rects = [...document.querySelectorAll(selector)].map((el) => el.getBoundingClientRect());
      if (!rects.length) return null;
      const left = Math.min(...rects.map((r) => r.left)), top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right)), bottom = Math.max(...rects.map((r) => r.bottom));
      return { getBoundingClientRect: () => DOMRect.fromRect({ x: left, y: top, width: right - left, height: bottom - top }) };
}, selector);

/** The lines of text on screen, in CSS px of the page scrolled to the top: the text of each node (clipped by the
 *  `overflow` around it) and the value of the fields (width measured in their font). A password field counts as its
 *  dots. The video checks with them that no view cuts a text at its edges. */
async function textLines(page) {
      return page.evaluate(() => {
            const round = (n) => Math.round(n * 10) / 10;
            const hidden = (el) => {
                  for (let a = el; a; a = a.parentElement) {
                        const s = getComputedStyle(a);
                        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return true;
                  }
                  return false;
            };
            const clipOf = (el) => {
                  const clip = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
                  for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
                        const s = getComputedStyle(a);
                        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
                        const r = a.getBoundingClientRect();
                        clip.left = Math.max(clip.left, r.left); clip.top = Math.max(clip.top, r.top);
                        clip.right = Math.min(clip.right, r.right); clip.bottom = Math.min(clip.bottom, r.bottom);
                  }
                  return clip;
            };
            const lines = [];
            const push = (el, r, text, kind) => {
                  const clip = clipOf(el);
                  const left = Math.max(r.left, clip.left), top = Math.max(r.top, clip.top);
                  const right = Math.min(r.right, clip.right), bottom = Math.min(r.bottom, clip.bottom);
                  if (right - left < 1 || bottom - top < 1) return;
                  lines.push({ text: text.slice(0, 32), kind, px: parseFloat(getComputedStyle(el).fontSize),
                        x: round(left + scrollX), y: round(top + scrollY), width: round(right - left), height: round(bottom - top) });
            };
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                  const text = node.textContent.trim();
                  const el = node.parentElement;
                  if (!text || !el || el.closest('select, option, script, style') || hidden(el)) continue;
                  const range = document.createRange();
                  range.selectNodeContents(node);
                  for (const r of range.getClientRects()) push(el, r, text, 'text');
            }
            const canvas = document.createElement('canvas').getContext('2d');
            for (const el of document.querySelectorAll('input, select, textarea')) {
                  if (hidden(el)) continue;
                  let text = el.tagName === 'SELECT' ? el.options[el.selectedIndex]?.text ?? '' : el.value || el.placeholder || '';
                  if (el.type === 'password' && el.value) text = '•'.repeat(el.value.length);
                  // the date and time fields show their own format, and a placeholder when empty (Chrome in French)
                  if (el.type === 'date') text = el.value ? el.value.split('-').reverse().join('/') : 'jj/mm/aaaa';
                  if (el.type === 'time') text = el.value || '--:--';
                  if (!text.trim()) continue;
                  const s = getComputedStyle(el);
                  const r = el.getBoundingClientRect();
                  const inLeft = r.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
                  const inRight = r.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight);
                  canvas.font = s.font;
                  const width = Math.min(canvas.measureText(text).width, inRight - inLeft);
                  const x = s.textAlign === 'center' ? (inLeft + inRight - width) / 2 : s.textAlign === 'right' || s.textAlign === 'end' ? inRight - width : inLeft;
                  const size = parseFloat(s.fontSize) * 1.2;
                  push(el, DOMRect.fromRect({ x, y: r.top + (r.height - size) / 2, width, height: size }), text, 'field');
            }
            return lines;
      });
}
const textFile = new URL('text.json', OUT);
const texts = {};

/** Checks the screen, writes the capture and the boxes. `fullPage` for the screens longer than the window. */
async function shot(page, file, boxes, { fullPage = false, formFilled = false } = {}) {
      // A long screen is captured in a window as tall as the page, as a tall browser shows it. A stitched capture of the
      // 900 px window would leave the fixed elements (the hidden toast, the action bar of the meeting) in the middle of
      // the page, where the window ended.
      if (fullPage) {
            for (let i = 0; i < 4; i++) {
                  const height = await page.evaluate(() => document.documentElement.scrollHeight);
                  if (height === page.viewportSize().height) break;
                  await page.setViewportSize({ width: VIEWPORT.width, height });
            }
            await settleClock(500);
      }
      await ready(page);
      const names = await guard(page, file, { formFilled });
      const measured = await boxes(page);
      for (const [key, value] of Object.entries(measured)) if (!value) throw new Error(`${file}: no ${key} box on screen`);
      await page.screenshot({ path: new URL(`${file}.png`, OUT).pathname });
      const entry = { ...measured };
      if (fullPage) entry.page = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
      manifest.shots[file] = entry;
      writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
      texts[file] = await textLines(page);
      writeFileSync(textFile, JSON.stringify(texts) + '\n');
      if (fullPage) await page.setViewportSize(VIEWPORT);
      log(`${file}.png  guard ok (${names} names checked)  ${JSON.stringify(entry)}`);
}

// ── The login ────────────────────────────────────────────────────────────────────────────────────────────────────────
const password = readFileSync(join(DEMO_DIR, 'demo-password'), 'utf8').trim();
const page = watch(await context.newPage());
await page.goto(`${WEB}/login.html`);
await page.locator('#login-form').waitFor();
await settleClock();
await page.fill('#email', data.account);
await page.fill('#password', password);
await shot(page, 'login', async (p) => ({
      card: await box(p, () => document.querySelector('.login-container')),
      form: await box(p, () => document.querySelector('#login-form')),
      footer: await box(p, () => document.querySelector('footer')),
}));
await Promise.all([page.waitForURL(/phare-gestion-harcelement\.html/, { timeout: 30000 }), page.click('#submit-btn')]);
log(`logged in as ${data.account} through the login screen`);

// ── The management page: a new case ─────────────────────────────────────────────────────────────────────────────────
await page.locator('#api-status.online').waitFor({ timeout: 30000 });
await page.locator('#history-list .history-card').nth(data.cases.length - 1).waitFor();
if ((await page.locator('#history-list .history-card').count()) !== data.cases.length) throw new Error('the history does not show the seeded cases');
await settleGsap(page);

await page.fill('#date', screenCase.date);
await page.fill('#heure', screenCase.heure);
for (const [k, student] of screenCase.eleves.entries()) {
      await page.click('[data-action="add-student"]');
      await settleClock(800);
      const card = page.locator('#students-list .student-card').nth(k);
      await card.locator('[data-field="nom"]').fill(student.nom);
      await card.locator('[data-field="classe"]').fill(student.classe);
      await card.locator('[data-field="type"]').selectOption(student.type.toLowerCase());
      if (student.lie_a) await card.locator('[data-field="lie_a"]').selectOption({ label: student.lie_a });
      if (student.membre) await card.locator('[data-field="membre"]').selectOption(student.membre);
}
await clockTo(AT.caso);
await settleGsap(page);
await shot(page, 'caso', async (p) => ({
      fields: await box(p, () => document.querySelector('.global-fields')),
      roles: await box(p, () => document.querySelector('#role-hint')),
      students: await box(p, () => document.querySelector('#students-list')),
      first: await box(p, () => document.querySelector('#students-list .student-card')),
      form: await around(p, '.global-fields, #role-hint, #students-list'),
}), { fullPage: true, formFilled: true });

await page.click('[data-action="save-case"]');
await page.getByText('Cas sauvegardé avec succès !').waitFor();
await page.locator('#history-list .history-card').nth(data.cases.length).waitFor();
await settleClock(3000); // the toast leaves after 2.5 s
await settleGsap(page);
log('the case of the screen is saved through the screen');

// ── The history and its search ──────────────────────────────────────────────────────────────────────────────────────
await clockTo(AT.historico);
await settleGsap(page);
const top = await page.locator('#history-list .history-card').first().innerText();
if (!top.includes(`Dossier du ${screenCase.date.split('-').reverse().join('/')}`)) throw new Error('historico: the case of the screen is not on top');
await shot(page, 'historico', async (p) => ({
      list: await box(p, () => document.querySelector('#history-list')),
      first: await box(p, () => document.querySelector('#history-list .history-card')),
      search: await box(p, () => document.querySelector('.search-bar')),
      heading: await around(p, '.search-bar, #history-list .history-card:nth-child(-n+2)'),
}), { fullPage: true });

await clockTo(AT.busca);
await page.fill('#search-input', data.search);
await page.locator('#search-count', { hasText: '2 résultats' }).waitFor();
await settleGsap(page);
await shot(page, 'busca', async (p) => ({
      search: await box(p, () => document.querySelector('.search-bar')),
      results: await box(p, () => document.querySelector('#history-list')),
      both: await around(p, '.search-bar, #history-list .history-card'),
}), { fullPage: true });
await page.fill('#search-input', '');
await settleGsap(page);

// ── The team ─────────────────────────────────────────────────────────────────────────────────────────────────────────
await clockTo(AT.equipe);
await page.click('[data-action="open-members"]');
await page.locator('#member-modal.active').waitFor();
if ((await page.locator('#member-list-items .card').count()) !== data.team.length) throw new Error('equipe: the team window does not list the five members');
await settleClock();
await shot(page, 'equipe', async (p) => ({
      modal: await box(p, () => document.querySelector('#member-modal .card')),
      list: await box(p, () => document.querySelector('#member-list-items')),
}));
// The list of the window scrolls inside 300 px, which hold four members: the second capture is the same window with
// the list scrolled to its end, where the fifth member is.
await page.locator('#member-list-items').evaluate((list) => { list.scrollTop = list.scrollHeight; });
await settleClock(1000);
if (await page.locator('#member-list-items').evaluate((list) => list.scrollTop === 0)) throw new Error('equipe-fim: the list did not scroll');
await shot(page, 'equipe-fim', async (p) => ({
      modal: await box(p, () => document.querySelector('#member-modal .card')),
      list: await box(p, () => document.querySelector('#member-list-items')),
}));
await page.click('[data-action="close-members"]');

// ── The meeting: the interviews ──────────────────────────────────────────────────────────────────────────────────────
// The planning of the other students goes to localStorage before the page opens, in its own format, with each
// student's position as in the GET /api/cas answer the page reads (the management page kept it in phare_cases).
const plan = await page.evaluate((planning) => {
      const cases = JSON.parse(localStorage.getItem('phare_cases') || '[]');
      const reunions = {};
      for (const entry of planning) {
            const c = cases.find((x) => x.date === entry.case);
            const i = c ? c.eleves.findIndex((e) => e.nom === entry.nom) : -1;
            if (i < 0) return { error: `${entry.nom} of ${entry.case} is not in the cases` };
            reunions[c.id] ??= { entretiens: {} };
            reunions[c.id].entretiens[i] = { membre: entry.membre, date: entry.date, heure: entry.heure };
      }
      localStorage.setItem('phare_reunions', JSON.stringify(reunions));
      return { members: JSON.parse(localStorage.getItem('phare_members') || '[]').length, cases: cases.length };
}, data.planning);
if (plan.error) throw new Error(plan.error);
if (plan.members !== data.team.length || plan.cases !== data.cases.length + 1) throw new Error(`the meeting would read ${plan.cases} cases and ${plan.members} members`);
log(`planning of ${data.planning.length} interviews written to localStorage (phare_reunions)`);

await clockTo(AT.pendentes);
await page.goto(`${WEB}/phare-reunion.html`);
await page.locator('#api-status.online').waitFor({ timeout: 30000 });
await page.locator('#cases-container .case-card').first().waitFor();
await settleGsap(page);
const students = [...data.cases, screenCase].reduce((n, c) => n + c.eleves.length, 0);
const stats = await page.locator('#stats-bar').textContent(); // innerText would follow the badges' uppercase
for (const want of [`${data.cases.length + 1} cas`, `${students} élèves`, `${data.planning.length} planifiés`]) {
      if (!stats.includes(want)) throw new Error(`pendentes: the counters say "${stats.replace(/\s+/g, ' ')}", not ${want}`);
}
await shot(page, 'pendentes', async (p) => ({
      heading: await box(p, () => document.querySelector('#pending-section .section-header')),
      stats: await box(p, () => document.querySelector('#stats-bar')),
      first: await box(p, () => document.querySelector('#cases-container .case-card')),
      top: await around(p, '#pending-section .section-header, #cases-container .case-card:nth-child(-n+2)'),
}), { fullPage: true });

const schedule = data.schedule;
const card = page.locator('#cases-container .case-card').first();
if (!(await card.innerText()).includes(`Dossier du ${schedule.case.split('-').reverse().join('/')}`)) throw new Error('agendar: the case of the screen is not the first');
const row = card.locator('.row-student', { hasText: schedule.nom });
await clockTo(AT.agendar);
await row.locator('select.f-membre').selectOption(schedule.membre);
await row.locator('input.f-heure').fill(schedule.heure);
await row.locator('input.f-heure').dispatchEvent('change');
await settleGsap(page);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('phare_reunions')));
const caseId = await card.getAttribute('id');
const entry = Object.values(saved[caseId.replace('case-', '')]?.entretiens ?? {}).find((e) => e.membre === schedule.membre && e.heure === schedule.heure);
if (!entry || entry.date) throw new Error('agendar: the intervenant and the time were not saved, or a date already was');
await shot(page, 'agendar', async (p) => ({
      card: await box(p, () => document.querySelector('#cases-container .case-card')),
      row: await box(p, (nom) => [...document.querySelectorAll('#cases-container .case-card:first-child .row-student')].find((r) => r.innerText.includes(nom)), schedule.nom),
}), { fullPage: true });

await row.locator('input.f-date').fill(schedule.date);
await row.locator('input.f-date').dispatchEvent('change');
await settleGsap(page);
await page.locator('#scheduled-section .case-student-row', { hasText: schedule.nom }).waitFor();
await clockTo(AT.planejamento);
await settleClock();
await shot(page, 'planejamento', async (p) => ({
      section: await box(p, () => document.querySelector('#scheduled-section')),
      group: await box(p, () => document.querySelector('#scheduled-grid .case-group-card')),
      row: await box(p, (nom) => [...document.querySelectorAll('#scheduled-grid .case-group-card:first-child .case-student-row')].find((r) => r.innerText.includes(nom)), schedule.nom),
}), { fullPage: true });

await browser.close();
log(`requests: ${Object.entries(hosts).map(([host, n]) => `${host} ${n}`).join(', ')}; blocked ${blocked.length}`);
if (problems.length) throw new Error(`the pages reported problems:\n${problems.join('\n')}`);
log(`captures written to ${OUT.pathname}`);
